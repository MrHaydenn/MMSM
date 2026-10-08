"""DNS plans for Java Edition; does not publish DNS or configure routing."""
import ipaddress
import re
from .store import require


def hostname(value):
    require(isinstance(value, str), 'Invalid domain name')
    value = value.strip().lower().rstrip('.')
    require(len(value) <= 253 and '.' in value and all(re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?', x) for x in value.split('.')), 'Use a full DNS name without a URL, port or wildcard')
    return value


def validate_settings(data):
    if not any(data.get(k) for k in ('dns_zone', 'dns_base', 'dns_ip')): return
    zone = hostname(data.get('dns_zone', '')); base = hostname(data.get('dns_base', ''))
    require(base.endswith('.' + zone), 'Base domain must be a subdomain of your DNS zone')
    try: address = ipaddress.ip_address(data.get('dns_ip', ''))
    except ValueError: raise ValueError('Enter the public IPv4 or IPv6 address of your Minecraft entry point')
    require(address.is_global, 'Enter a public IP address, not a LAN or loopback address')


def plan(settings, server):
    configured = all(settings.get(k) for k in ('dns_zone', 'dns_base', 'dns_ip'))
    value = server.get('public_address', {})
    if not configured: return {'configured': False, 'value': value, 'records': []}
    validate_settings(settings)
    base = hostname(settings['dns_base']); zone = hostname(settings['dns_zone'])
    label = value.get('label', '')
    if not label: return {'configured': True, 'base': base, 'value': value, 'records': []}
    domain = label + '.' + base; port = value.get('port', server['port'])
    relative = lambda name: name[:-len(zone)-1] if name.endswith('.' + zone) else name
    address = ipaddress.ip_address(settings['dns_ip'])
    return {'configured': True, 'base': base, 'hostname': domain, 'value': value,
            'records': [
                {'type': 'A' if address.version == 4 else 'AAAA', 'name': relative(base), 'content': str(address), 'proxy': 'DNS only'},
                {'type': 'CNAME', 'name': relative(domain), 'content': base, 'proxy': 'DNS only'},
                {'type': 'SRV', 'name': relative('_minecraft._tcp.' + domain), 'content': f'0 5 {port} {base}', 'proxy': 'DNS only'}],
            'srv': {'service': '_minecraft', 'protocol': '_tcp', 'priority': 0, 'weight': 5, 'port': port, 'target': base},
            'forwarding': f'TCP external port {port} → MMSM host port {server["port"]} (not its internal backend port).'}


def save(manager, sid, data):
    with manager.locks[sid]:
        server = manager.active(sid); label = str(data.get('label', '')).strip().lower()
        require(not label or re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?', label), 'Choose one DNS label: letters, numbers and hyphens')
        port = int(data.get('port', server['port']))
        require(1 <= port <= 65535, 'External port must be 1–65535')
        require(not label or not any(s['id'] != sid and s.get('public_address', {}).get('label') == label for s in manager.store.servers()), 'That public name is already assigned', 409)
        server['public_address'] = {'label': label, 'port': port}
        result = plan(manager.store.settings(), server)
        require(result['configured'] or not label, 'Configure the DNS zone, base domain and public IP in wrapper Settings first')
        manager.store.save_server(server)
        return result
