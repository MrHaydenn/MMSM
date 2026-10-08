"""DNS plans for Java Edition; optional Cloudflare publishing; does not configure routing."""
import ipaddress
import re
import threading
PUBLISH_LOCK = threading.RLock()
from .store import require, Problem


def hostname(value):
    require(isinstance(value, str), 'Invalid domain name')
    value = value.strip().lower().rstrip('.')
    require(len(value) <= 253 and '.' in value and all(re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?', x) for x in value.split('.')), 'Use a full DNS name without a URL, port or wildcard')
    return value


def validate_settings(data):
    require(type(data.get('dns_auto', False)) is bool, 'Invalid DNS automation preference')
    provider=data.get('dns_provider','cloudflare')
    require(provider in ('cloudflare','unm'), 'Choose Cloudflare or UNM DNS')
    if provider=='unm' and data.get('unm_url'): unm_url(data['unm_url'])
    if data.get('dns_auto') and provider=='unm':
        unm_url(data.get('unm_url',''))
        require(bool(data.get('unm_token')), 'Enter a UNM integration token')
        require(data.get('dns_base')==data.get('dns_zone'), 'For UNM, DNS zone and base domain must both be the delegated zone')
    if data.get('dns_auto') and provider=='cloudflare':
        require(isinstance(data.get('dns_zone_id'), str) and re.fullmatch(r'[a-fA-F0-9]{32}', data['dns_zone_id']), 'Enter the Cloudflare Zone ID')
        require(bool(data.get('dns_token')), 'Enter a Cloudflare API token')
        require(all(data.get(k) for k in ('dns_zone','dns_base','dns_ip')), 'Configure the DNS zone, base domain and public IP before enabling automation')
    if not any(data.get(k) for k in ('dns_zone', 'dns_base', 'dns_ip')): return
    zone = hostname(data.get('dns_zone', '')); base = hostname(data.get('dns_base', ''))
    require(base.endswith('.' + zone) or data.get('dns_provider')=='unm' and base==zone, 'Base domain must be a subdomain of your DNS zone')
    try: address = ipaddress.ip_address(data.get('dns_ip', ''))
    except ValueError: raise ValueError('Enter the public IPv4 or IPv6 address of your Minecraft entry point')
    require(address.is_global, 'Enter a public IP address, not a LAN or loopback address')


def plan(settings, server):
    configured = all(settings.get(k) for k in ('dns_zone', 'dns_base', 'dns_ip'))
    value = server.get('public_address', {})
    if not configured: return {'configured': False, 'value': value, 'records': [], 'automation': server.get('dns_status', 'Not published'), 'automatic': settings.get('dns_auto', False)}
    validate_settings(settings)
    base = hostname(settings['dns_base']); zone = hostname(settings['dns_zone'])
    label = value.get('label', '')
    if not label: return {'configured': True, 'base': base, 'value': value, 'records': [], 'automation': server.get('dns_status', 'Not published'), 'automatic': settings.get('dns_auto', False)}
    domain = label + '.' + base; port = value.get('port', server['port'])
    relative = lambda name: name[:-len(zone)-1] if name.endswith('.' + zone) else name
    address = ipaddress.ip_address(settings['dns_ip'])
    if settings.get('dns_provider')=='unm':
        return {'configured':True,'provider':'unm','base':base,'hostname':domain,'value':value,
                'srv':dict(port=port,target=domain),
                'records':[{'type':'A','name':label,'content':str(address),'proxy':'DNS only'},
                           {'type':'SRV','name':'_minecraft._tcp.'+label,'content':f'0 5 {port} {domain}','proxy':'DNS only'}],
                'automation':server.get('dns_status','Not published'),'automatic':settings.get('dns_auto',False),
                'forwarding':f'TCP external port {port} → MMSM host port {server["port"]}. Configure forwarding in UNM separately.'}
    return {'configured': True, 'base': base, 'hostname': domain, 'value': value,
            'records': [
                {'type': 'A' if address.version == 4 else 'AAAA', 'name': relative(base), 'content': str(address), 'proxy': 'DNS only'},
                {'type': 'CNAME', 'name': relative(domain), 'content': base, 'proxy': 'DNS only'},
                {'type': 'SRV', 'name': relative('_minecraft._tcp.' + domain), 'content': f'0 5 {port} {base}', 'proxy': 'DNS only'}],
            'automation': server.get('dns_status', 'Not published'), 'automatic': settings.get('dns_auto', False),
            'srv': {'service': '_minecraft', 'protocol': '_tcp', 'priority': 0, 'weight': 5, 'port': port, 'target': base},
            'forwarding': f'TCP external port {port} → MMSM host port {server["port"]} (not its internal backend port).'}


def save(manager, sid, data):
    with manager.lock, manager.locks[sid]:
        server = manager.active(sid)
        server['public_address'] = validate_address(manager, data, sid, server['port'])
        result = plan(manager.store.settings(), server)
        require(result['configured'] or not server['public_address']['label'], 'Configure the DNS zone, base domain and public IP in wrapper Settings first')
        manager.store.save_server(server)
    publish(manager, sid)
    return plan(manager.store.settings(), manager.store.server(sid))


def validate_address(manager, data, sid=None, default_port=25565):
    label = str(data.get('label', '')).strip().lower()
    require(not label or re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?', label), 'Choose one DNS label: letters, numbers and hyphens')
    port = int(data.get('port', default_port))
    require(1 <= port <= 65535, 'External port must be 1–65535')
    require(not label or not any(s['id'] != sid and s.get('public_address', {}).get('label') == label for s in manager.store.servers()), 'That public name is already assigned', 409)
    require(not label or all(manager.store.settings().get(k) for k in ('dns_zone','dns_base','dns_ip')), 'Configure Minecraft domains in wrapper Settings first')
    if label: hostname(label + '.' + hostname(manager.store.settings()['dns_base']))
    return {'label': label, 'port': port}


def cloudflare(settings, method, suffix, body=None):
    import json
    import urllib.request
    import urllib.error
    url = 'https://api.cloudflare.com/client/v4/zones/' + settings['dns_zone_id'] + suffix
    request = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None,
        headers={'Authorization': 'Bearer ' + settings['dns_token'], 'Content-Type': 'application/json'}, method=method)
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            value = json.load(response)
        require(value.get('success') is True, 'Cloudflare rejected the DNS request', 502)
        return value['result']
    except (urllib.error.URLError, ValueError):
        raise ValueError('Cloudflare DNS request failed. Check the zone ID, token permissions and network connection.') from None


def publish(manager, sid):
    # Server lock prevents edits from racing publication; failed operations are retried.
    from urllib.parse import urlencode
    with manager.locks[sid], PUBLISH_LOCK:
        settings = manager.store.settings(); server = manager.store.server(sid)
        if not settings.get('dns_auto') or server['archived']: return
        try:
            validate_settings(settings)
            if settings.get('dns_provider')=='unm':
                require(not server.get('dns_managed'), 'Remove previous Cloudflare records before switching providers')
                identity={'url':unm_url(settings['unm_url']),'zone':settings['dns_zone']}
                require(not server.get('unm_managed') or server['unm_managed']==identity, 'Clear the address using the previous UNM endpoint and zone before changing them')
                value=server.get('public_address',{})
                wanted=bool(value.get('label'))
                result=unm_request(settings,sid,{'zone':settings['dns_zone'],'label':value['label'],'port':value.get('port',server['port'])} if wanted else None)
                require(not wanted or result.get('hostname')==value['label']+'.'+settings['dns_base'], 'UNM token zone does not match the base domain')
                server['unm_managed']=identity if wanted else None
                server['dns_status']='Published to UNM' if wanted else 'Address removed from UNM'
                manager.store.save_server(server)
                return
            require(not server.get('unm_managed'), 'Clear the address with UNM before switching providers')
            # Verify the supplied ID belongs to the configured zone before writing.
            zone = cloudflare(settings, 'GET', '')
            require(zone['name'].lower() == hostname(settings['dns_zone']), 'Cloudflare Zone ID does not match DNS zone')
            desired = plan(settings, server)['records']; owned = server.get('dns_managed', [])
            live = []
            for record in desired:
                name = record['name'] + '.' + hostname(settings['dns_zone'])
                comment = 'MMSM:' + ('base' if record['type'] in ('A','AAAA') else sid)
                rows = cloudflare(settings, 'GET', '/dns_records?' + urlencode({'name': name, 'per_page':100}))
                require(not rows or len(rows)==1 and rows[0].get('comment')==comment and rows[0]['type']==record['type'], 'DNS conflict at ' + name + '. Existing records are not owned by MMSM; remove them manually to let MMSM manage this name.')
                body = {'type':record['type'], 'name':name, 'content':record['content'], 'ttl':1, 'comment':comment}
                if record['type'] != 'SRV': body['proxied'] = False
                saved = rows[0] if rows and all(rows[0].get(k)==v for k,v in body.items()) else cloudflare(settings, 'PUT' if rows else 'POST', '/dns_records' + ('/'+rows[0]['id'] if rows else ''), body)
                if comment != 'MMSM:base':
                    entry = {'id':saved['id'], 'zone':settings['dns_zone_id'], 'name':name}
                    live.append(entry)
                    if entry not in owned: owned.append(entry)
                    server['dns_managed'] = owned; manager.store.save_server(server)
            for entry in owned[:]:
                if entry in live: continue
                require(entry['zone']==settings['dns_zone_id'], 'Old DNS records belong to another zone; remove them manually before changing the Zone ID')
                rows = cloudflare(settings,'GET','/dns_records?' + urlencode({'name':entry['name']}))
                old = next((r for r in rows if r['id']==entry['id']),None)
                if old:
                    require(old.get('comment')=='MMSM:'+sid, 'Old DNS record ownership changed; remove it manually')
                    cloudflare(settings,'DELETE','/dns_records/'+entry['id'])
                owned.remove(entry)
                server['dns_managed']=owned;manager.store.save_server(server)
            server['dns_status'] = 'Published to Cloudflare' if desired else 'Address removed from Cloudflare'
        except Exception as error:
            server['dns_status'] = 'DNS publishing failed: ' + str(error)
        manager.store.save_server(server)


def publish_all(manager):
    for server in manager.store.servers(False):
        if server.get('public_address', {}).get('label') or server.get('dns_managed') or server.get('unm_managed'):
            try: publish(manager, server['id'])
            except Problem as error:
                if error.status != 404: raise  # Deletion can race acquiring the server lock.


def loop(manager):
    while not manager.closing.is_set():
        publish_all(manager)
        if manager.closing.wait(300): break


def unm_url(value):
    from urllib.parse import urlsplit
    require(isinstance(value,str), 'Enter the UNM URL')
    u=urlsplit(value)
    require(u.scheme in ('http','https') and bool(u.hostname) and not u.username and not u.password and not u.query and not u.fragment and u.path in ('','/'), 'Use a UNM origin URL without a path or credentials')
    require(u.scheme=='https' or u.hostname in ('127.0.0.1','localhost','::1'), 'Use HTTPS or a localhost SSH tunnel for the UNM token')
    return value.rstrip('/')


def unm_request(settings, sid, body):
    import json
    import urllib.request
    import urllib.error
    from urllib.parse import quote
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None
    req=urllib.request.Request(unm_url(settings['unm_url'])+'/api/integrations/servers/'+quote(sid,safe=''),
        data=json.dumps(body).encode() if body is not None else None,
        headers={'Authorization':'Bearer '+settings['unm_token'],'Content-Type':'application/json'},method='PUT' if body is not None else 'DELETE')
    try:
        with urllib.request.build_opener(NoRedirect()).open(req,timeout=20) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        try: message=json.loads(error.read(16384)).get('error','Request rejected')
        except (ValueError,AttributeError): message='Request rejected'
        raise ValueError('UNM DNS: '+message) from None
    except (urllib.error.URLError,ValueError):
        raise ValueError('Cannot contact UNM DNS. Check the URL, SSH tunnel, token and backend status.') from None
