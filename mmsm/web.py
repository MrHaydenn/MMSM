import collections
import hashlib
import hmac
from http import HTTPStatus
from http.cookies import CookieError, SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import ipaddress
import json
import mimetypes
import os
import re
from pathlib import Path
import secrets
import threading
import time
import traceback
from urllib.parse import parse_qs, urlparse

from .web_features import scope, can_see, enforce_scope, extra_route, user_public, validate_scope

from .store import Problem, require, password_hash, password_matches
from .manager import LOADERS, PROTECTED_PROPERTIES


def session_cookies(headers):
    """Parse only our cookies; unrelated domain cookies may contain raw JSON.

    SimpleCookie stops parsing the entire header at some nonstandard values.
    Isolate each named session cookie so those values cannot hide a login.
    Reject duplicate session names rather than guessing which one to trust.
    """
    result, seen = {}, set()
    for header in headers:
        for part in header.split(';'):
            name = part.partition('=')[0].strip()
            if name not in ('mmsm_session', 'mmsm_session_http'):
                continue
            if name in seen:
                result.pop(name, None)
                continue
            seen.add(name)
            cookie = SimpleCookie()
            try:
                cookie.load(part.strip())
            except CookieError:
                continue
            if name in cookie and re.fullmatch(r'[A-Za-z0-9_-]{43}', cookie[name].value):
                result[name] = cookie[name].value
    return result


class WebServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True
    def __init__(self, address, manager, origin=None):
        self.manager = manager
        from .web_config import public_origin
        self.origin = public_origin(origin) if origin else None
        self.setup_token = os.environ.get('MMSM_SETUP_TOKEN') or secrets.token_urlsafe(24)
        self.attempts = collections.defaultdict(collections.deque)
        self.rate_lock = threading.Lock()
        self.capacity = threading.BoundedSemaphore(64)
        super().__init__(address, Handler)

    def process_request(self, request, client_address):
        if not self.capacity.acquire(blocking=False):
            request.close()
            return
        try:
            super().process_request(request, client_address)
        except Exception:
            self.capacity.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            request.settimeout(20)
            super().process_request_thread(request, client_address)
        finally:
            self.capacity.release()


class Handler(BaseHTTPRequestHandler):
    server_version = 'MMSM'

    def log_message(self, fmt, *args):
        # Never log credentials, bodies or query strings.
        print(f'HTTP {self.client_address[0]} {self.command} {urlparse(self.path).path}', flush=True)

    def reply(self, data, code=200, headers=None, content_type='application/json; charset=utf-8'):
        if getattr(self,'user',None) is not None:
            from .permissions import public_server
            def decorate(value):
                if isinstance(value,list):return [decorate(v) for v in value]
                if isinstance(value,dict):
                    if {'id','loader','minecraft','port'} <= value.keys():return public_server(self,value)
                    return {k:decorate(v) for k,v in value.items()}
                return value
            data=decorate(data)
        payload = json.dumps(data).encode() if isinstance(data, (dict, list)) else data
        self.send_response(code)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'same-origin')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://cdn.modrinth.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
        for key, value in (headers or {}).items(): self.send_header(key, value)
        self.end_headers()
        try: self.wfile.write(payload)
        except (BrokenPipeError, ConnectionResetError): pass

    def role(self, minimum):
        if getattr(self,'server_authorized',False):return
        if self.url.path.startswith(('/api/downloads','/api/download-history')):
            from .permissions import creator_allowed, any_capability
            require(creator_allowed(self.user) or any_capability(self,'downloads') or self.user['role'] in ('owner','admin','operator') and self.user.get('permissions') is None,'Download history permission required',403)
            return
        levels = {'viewer': 0, 'operator': 1, 'admin': 2, 'owner': 3}
        require(levels[self.user['role']] >= levels[minimum], 'Your account does not have permission for this action', 403)

    def security(self):
        from .web_config import public_origin
        raw_host = self.headers.get('Host', '')
        require(raw_host and '/' not in raw_host and '@' not in raw_host and '\\' not in raw_host, 'Invalid Host header', 403)
        direct = public_origin('http://' + raw_host)
        host = urlparse(direct).hostname
        direct_allowed = host == 'localhost'
        try:
            address=ipaddress.ip_address(host)
            direct_allowed = direct_allowed or address.is_private or address.is_global
        except ValueError: pass
        configured = self.server.origin
        configured_host = bool(configured and urlparse(configured).netloc == urlparse(direct).netloc)
        require(direct_allowed or configured_host, 'Host not allowed. Set Public URL in Settings for a public hostname.', 403)
        require(self.headers.get('Sec-Fetch-Site', 'same-origin') != 'cross-site', 'Cross-site request blocked', 403)
        allowed = {direct} if direct_allowed else set()
        if configured_host: allowed.add(configured)
        # The public URL is an additional entry point, not a replacement for direct IP access.
        origin = self.headers.get('Origin')
        if origin:
            try: origin=public_origin(origin)
            except Problem: origin=None
            require(origin in allowed, 'Origin mismatch. Use the same browser URL for the page and API; configure Public URL for HTTPS and preserve Host in the proxy.', 403)
            self.request_origin=origin
        else:
            self.request_origin=configured if configured_host else direct
        self.secure_request=self.request_origin.startswith('https://')

    def session_cookie_header(self, token='', expire=False, name=None):
        name=name or ('mmsm_session' if self.secure_request else 'mmsm_session_http')
        return name+'='+token+'; HttpOnly; SameSite=Strict; Path=/; Max-Age='+('0' if expire else '86400')+('; Secure' if self.secure_request else '')

    def rate_limit(self):
        now = time.monotonic()
        with self.server.rate_lock:
            # Bound memory even with many source addresses.
            if len(self.server.attempts) > 10000:
                stale = [ip for ip, times in self.server.attempts.items() if not times or times[-1] < now - 60]
                for ip in stale: self.server.attempts.pop(ip, None)
                require(len(self.server.attempts) <= 10000, 'Try again later', 429)
            times = self.server.attempts[self.client_address[0]]
            while times and times[0] < now - 60: times.popleft()
            require(len(times) < 10, 'Too many attempts. Try again in one minute.', 429)
            times.append(now)

    def do_GET(self): self.handle_request()
    def do_POST(self): self.handle_request()
    def do_PUT(self): self.handle_request()
    def do_DELETE(self): self.handle_request()

    def handle_request(self):
        try:
            self.security()
            self.url = urlparse(self.path)
            self.query = {k: v[0] for k, v in parse_qs(self.url.query).items()}
            self.parts = self.url.path.strip('/').split('/')
            self.data = {}
            self.user = None
            if self.command in ('POST', 'PUT', 'DELETE'):
                require(not self.headers.get('Transfer-Encoding'), 'Chunked requests are not supported')
                length = int(self.headers.get('Content-Length', 0))
                if self.command == 'POST' and len(self.parts) == 4 and self.parts[:2] == ['api', 'servers'] and self.parts[3] in ('upload','mods-upload'):
                    self.authenticate()
                    enforce_scope(self)
                    self.role('admin')
                    self.server.manager.syncs.guard(self.parts[2], self.headers.get("X-MMSM-Unlink-Sync") == "true", resource="mods" if self.parts[3]=="mods-upload" else "files", paths=[self.query.get("path", "")])
                    require(self.headers.get('Content-Length') is not None, 'Content-Length is required', 411)
                    require(self.headers.get('Content-Type', '').split(';')[0] == 'application/octet-stream', 'Use application/octet-stream for uploads', 415)
                    result = (self.server.manager.upload_mod(self.parts[2],self.query.get('name',''),self.rfile,length) if self.parts[3]=='mods-upload' else self.server.manager.upload_file(self.parts[2], self.query.get('path', ''), self.rfile, length))
                    self.server.manager.store.audit(self.user['username'], 'Uploaded file to server ' + self.parts[2] + ': ' + self.query.get('path', ''))
                    self.reply(result, 201)
                    return
                require(0 <= length <= 3 * 1024**2, 'Request body too large', 413)
                if length:
                    require(self.headers.get('Content-Type', '').split(';')[0] == 'application/json', 'Use application/json', 415)
                    self.data = json.loads(self.rfile.read(length))
                    require(isinstance(self.data, dict), 'JSON object required')
            self.dispatch()
        except Problem as e:
            self.reply({'error': str(e)}, e.status)
        except (ValueError, TypeError, KeyError, UnicodeError) as e:
            self.reply({'error': 'Invalid request: ' + str(e)}, 400)
        except FileNotFoundError:
            self.reply({'error': 'File not found'}, 404)
        except OSError as e:
            self.reply({'error': str(e)}, 409)
        except Exception:
            traceback.print_exc()
            self.reply({'error': 'Internal error. See the manager log.'}, 500)

    def authenticate(self):
        cookie = session_cookies(self.headers.get_all('Cookie', []))
        preferred='mmsm_session' if self.secure_request else 'mmsm_session_http'
        names=[preferred,*[n for n in ('mmsm_session','mmsm_session_http') if n!=preferred]]
        self.user=None
        for name in names:
            if name not in cookie:continue
            token=cookie[name]
            try: candidate=self.server.manager.store.session(token)
            except Problem: continue
            if self.command!='GET' and not hmac.compare_digest(self.headers.get('X-CSRF-Token',''),candidate['csrf']):continue
            self.user=candidate;self.session_token=token;self.session_cookie=name;break
        if self.user is None:
            # Retain a distinct CSRF error when a valid session was supplied.
            for name in names:
                if name not in cookie:continue
                try:self.server.manager.store.session(cookie[name])
                except Problem:continue
                raise Problem('CSRF token missing or invalid',403)
            raise Problem('Please sign in',401)

    def dispatch(self):
        manager, store = self.server.manager, self.server.manager.store
        path, method, data = self.url.path, self.command, self.data
        if path in ('/favicon.svg','/favicon.ico') and method == 'GET':
            file=store.root/'images'/'logo.png'
            if file.is_file():self.reply(file.read_bytes(),content_type='image/png')
            else:self.reply((Path(__file__).parent/'static'/'favicon.svg').read_bytes(),content_type='image/svg+xml')
            return
        if path == '/theme.css' and method == 'GET':
            from .themes import css
            self.reply(css(store.settings()['theme']).encode(),content_type='text/css'); return
        if not path.startswith('/api/'):
            require(method == 'GET', 'Method not allowed', 405)
            filenames = {'/': 'index.html', '/app.js': 'app.js', '/style.css': 'style.css'}
            require(path in filenames, 'Not found', 404)
            file = Path(__file__).parent / 'static' / filenames[path]
            self.reply(file.read_bytes(), content_type=mimetypes.guess_type(file.name)[0] + '; charset=utf-8')
            return
        if path == '/api/setup' and method == 'GET':
            self.reply({'required': not bool(store.rows('SELECT 1 FROM users LIMIT 1'))})
            return
        if path == '/api/setup' and method == 'POST':
            self.rate_limit()
            require(hmac.compare_digest(str(data.get('token', '')), self.server.setup_token), 'Enter the setup token printed in the MMSM terminal', 403)
            user = store.add_user(data.get('username'), data.get('password'), 'owner', first=True)
            store.audit(user['username'], 'Owner account created')
            self.reply({'created': True}, 201)
            return
        if path == '/api/login' and method == 'POST':
            self.rate_limit()
            user, token, csrf = store.login(data.get('username', ''), data.get('password', ''))
            self.reply({'user': user, 'csrf': csrf}, headers={'Set-Cookie': self.session_cookie_header(token)})
            return
        from .launcher import public_route, account_route
        if public_route(self): return
        self.authenticate()
        if account_route(self): return
        enforce_scope(self)
        require(method=='GET' or not manager.updater.installing, 'MMSM update in progress',409)
        if len(self.parts) == 4 and self.parts[:2] == ['api', 'servers'] and method != 'GET' and self.parts[3] in ('files', 'mods-install', 'mods-toggle', 'pack-install', 'project-install', 'update', 'sync-edit'):
            self.role('admin')
            action=self.parts[3]
            resource=None if action=='pack-install' else 'runtime' if action=='update' else 'files' if action=='files' else 'mods'
            paths=[self.query.get('path',data.get('path',''))]
            if action=='sync-edit': resource=data.get('resource');paths=data.get('paths',[])
            manager.syncs.guard(self.parts[2], self.headers.get('X-MMSM-Unlink-Sync') == 'true',resource=resource,paths=paths)
        if extra_route(self):
            if method != 'GET': store.audit(self.user['username'], method + ' ' + path)
            return
        token = self.session_token
        if path == '/api/me' and method == 'GET':
            self.reply({'user': user_public(self.user), 'csrf': self.user['csrf']}); return
        if path == '/api/logout' and method == 'POST':
            store.execute('DELETE FROM sessions WHERE token=?', (hashlib.sha256(token.encode()).hexdigest(),))
            self.reply({'ok': True}, headers={'Set-Cookie': self.session_cookie_header(expire=True,name=self.session_cookie)}); return
        if path == '/api/username' and method == 'POST':
            import re
            name = data.get('username', '')
            require(isinstance(name, str) and re.fullmatch(r'[a-zA-Z0-9_.-]{3,32}', name), 'Username must be 3–32 letters, numbers, dots, underscores or hyphens')
            row = store.rows('SELECT password FROM users WHERE id=?', (self.user['id'],))[0]
            require(password_matches(data.get('current', ''), row['password']), 'Current password is incorrect', 403)
            require(not store.rows('SELECT id FROM users WHERE username=? AND id<>?', (name, self.user['id'])), 'Username is already taken', 409)
            store.execute('UPDATE users SET username=? WHERE id=?', (name, self.user['id']))
            self.reply({'saved': True}); return
        if path == '/api/password'  and method == 'POST':
            self.rate_limit()
            row = store.rows('SELECT password FROM users WHERE id=?', (self.user['id'],))[0]
            require(password_matches(data.get('current', ''), row['password']), 'Current password is incorrect', 403)
            store.execute('UPDATE users SET password=? WHERE id=?', (password_hash(data.get('password', '')), self.user['id']))
            store.execute('DELETE FROM sessions WHERE user_id=?', (self.user['id'],))
            from .launcher import revoke_user
            revoke_user(store,self.user['id'])
            self.reply({'changed': True},headers={'Set-Cookie':self.session_cookie_header(expire=True,name=self.session_cookie)}); return
        if path == '/api/dashboard' and method == 'GET': self.reply(manager.dashboard(scope(self))); return
        if path == '/api/history' and method == 'GET':
            from .permissions import capabilities
            allowed=[s['id'] for s in store.servers() if can_see(self,s['id']) and capabilities(self.user,s)['analytics']]
            self.reply(manager.history(hours=int(self.query.get('hours',24)),allowed=allowed)); return
        if path == '/api/servers' and method == 'GET':
            archive = self.query.get('archive') == 'true'
            self.reply([manager.public(s) for s in store.servers(archive) if can_see(self,s["id"])]); return
        if path == '/api/servers' and method == 'POST':
            from .permissions import creator_allowed
            require(creator_allowed(self.user),'Server creation permission required',403)
            if data.get('source_id'):
                from .permissions import capabilities
                require(can_see(self,data['source_id']),'Source server not found',404)
                require(all(capabilities(self.user,store.server(data['source_id'])).values()),'Full control of the source server is required',403)
            result = manager.create({**data,'created_by':self.user['id']})
            store.audit(self.user['username'], 'Created server ' + result['id'])
            self.reply(result, 201); return
        if path == '/api/creation-defaults' and method == 'GET':
            from .permissions import creator_allowed
            require(creator_allowed(self.user),'Server creation permission required',403)
            values=store.settings();self.reply({k:values[k] for k in ('default_loader','default_memory_mb','default_sleep','auto_eula','dns_base','default_port_min','default_port_max')});return
        if path == '/api/catalog' and method == 'GET':
            from .permissions import creator_allowed, any_capability
            require(creator_allowed(self.user) or any_capability(self,'runtime'),'Server creation or runtime-update permission required',403)
            self.reply(manager.stable_catalog(self.query.get('loader', 'fabric'), self.query.get('minecraft'), self.query.get('experimental')=='true')); return
        if path == '/api/modrinth/search' and method == 'GET':
            self.role('admin')
            sid = self.query.get('server_id')
            s = manager.active(sid) if sid else {}
            self.reply(manager.providers.search(self.query.get('q', ''), s.get('loader'), s.get('minecraft'), self.query.get('type', 'mod'), int(self.query.get('offset', 0)), int(self.query.get('limit', 12)), self.query.get('index', 'downloads'))); return
        if path == '/api/modrinth/versions' and method == 'GET':
            self.role('admin')
            s = manager.active(self.query['server_id'])
            if self.query.get('type') == 'modpack':
                from .providers import MODRINTH
                from urllib.parse import quote
                result = manager.providers.get(MODRINTH + '/project/' + quote(self.query['project'], safe='') + '/version')
            else: result = manager.providers.mod_versions(self.query['project'], s)
            self.reply(result); return
        if path == '/api/downloads' and method == 'GET':
            self.role('operator')
            self.reply(store.download_history(scope(self), self.user['id'])); return
        if path == '/api/downloads/dismiss' and method == 'POST':
            self.role('operator')
            target = data.get('id')
            rows = store.rows('SELECT id,data FROM downloads WHERE id=?', (target,)) if target else store.rows('SELECT id,data FROM downloads')
            if target:
                require(rows, 'Download not found', 404)
                require(json.loads(rows[0]['data'])['status'] not in ('queued', 'downloading'), 'Active downloads cannot be dismissed', 409)
            for row in rows:
                if (scope(self) is None or json.loads(row['data']).get('server_id') in scope(self)) and json.loads(row['data'])['status'] not in ('queued', 'downloading'):
                    store.execute('INSERT OR IGNORE INTO dismissed_downloads VALUES(?,?)', (self.user['id'], row['id']))
            self.reply({'dismissed': True}); return
        if path == '/api/notifications' and method == 'GET':
            self.reply(store.rows('SELECT * FROM notifications ORDER BY created DESC LIMIT 100')); return
        if path == '/api/notifications/read' and method == 'POST':
            self.role('operator'); store.execute('UPDATE notifications SET seen=1'); self.reply({'ok': True}); return
        if path == '/api/unm-connection' and method == 'GET':
            self.role('admin')
            self.reply(manager.unm_tunnel.status()); return
        if path == '/api/unm-connection/test' and method == 'POST':
            self.role('admin')
            from .domains import check_unm
            self.reply(check_unm(store.settings())); return
        if path == '/api/settings':
            self.role('admin')
            if method == 'GET':
                safe = store.settings(); safe['dns_token_saved'] = bool(safe.pop('dns_token', '')); safe['unm_token_saved'] = bool(safe.pop('unm_token', ''))
                self.reply({**safe, 'unm_connection': manager.unm_tunnel.status(), 'running_web_port': self.server.server_port, 'running_bind_host': self.server.server_address[0], 'wrapper_update': manager.updater.status()}); return
            if method == 'PUT':
                allowed = {'default_port_min','default_port_max','unm_tunnel_enabled','unm_ssh_host','unm_ssh_user','unm_ssh_port','unm_ssh_key','unm_local_port','dns_provider', 'unm_url', 'unm_token', 'update_channel', 'dns_auto', 'dns_zone_id', 'dns_token', 'dns_zone', 'dns_base', 'dns_ip', 'bind_host', 'public_origin', 'web_port', 'default_loader', 'default_memory_mb', 'default_sleep', 'idle_minutes', 'retention_days', 'update_interval_hours', 'upstream_contact', 'auto_eula', 'theme', 'update_feed', 'wrapper_update_checks'}
                require(set(data) <= allowed, 'Unknown setting')
                from .web_config import public_origin
                if 'public_origin' in data:data['public_origin']=public_origin(data['public_origin'])
                if data.get('dns_token') == '': data.pop('dns_token')
                require(isinstance(data.get('dns_token', ''), str) and len(data.get('dns_token', ''))<=512 and not any(c in data.get('dns_token', '') for c in '\r\n'), 'Invalid DNS token')
                if data.get('unm_token') == '': data.pop('unm_token')
                require(isinstance(data.get('unm_token',''),str) and len(data.get('unm_token',''))<=512 and not any(c in data.get('unm_token','') for c in '\r\n'), 'Invalid UNM token')
                values = {**store.settings(), **data}
                from .domains import validate_settings
                from .unm_tunnel import validate as validate_tunnel
                data['unm_tunnel_enabled'] = False
                values['unm_tunnel_enabled'] = False
                validate_tunnel(values)
                if values.get('unm_tunnel_enabled'):
                    data['unm_url']='http://127.0.0.1:'+str(values['unm_local_port'])
                    values['unm_url']=data['unm_url']
                validate_settings(values)
                require(values['bind_host'] in ('0.0.0.0','127.0.0.1'),'Choose all interfaces or localhost')
                import re
                require(type(values['auto_eula']) is bool, 'Invalid EULA preference')
                from .themes import THEMES
                from .updater import validate_url
                require(values['theme'] in THEMES, 'Unknown theme')
                require(values['update_channel'] in ('stable','experimental'), 'Unknown update channel')
                require(type(values['wrapper_update_checks']) is bool,'Invalid update preference')
                require(isinstance(values['update_feed'],str) and len(values['update_feed'])<=2048,'Invalid release feed')
                if values['update_feed']:validate_url(values['update_feed'])
                for key, lo, hi in [('default_port_min',1024,65535),('default_port_max',1024,65535),('web_port', 1024, 65535), ('default_memory_mb', 512, 262144), ('idle_minutes', 1, 1440), ('retention_days', 1, 365), ('update_interval_hours', 1, 168)]:
                    require(type(values[key]) is int and lo <= values[key] <= hi, f'Invalid {key}')
                require(values.get('default_port_min',25565) <= values.get('default_port_max',25665), 'Port range minimum must not exceed maximum')
                require(values['default_loader'] in LOADERS, 'Invalid default loader')
                require(isinstance(values['default_sleep'], bool), 'Invalid sleep default')
                require(isinstance(values['upstream_contact'], str) and len(values['upstream_contact']) <= 200 and '\n' not in values['upstream_contact'] and '\r' not in values['upstream_contact'], 'Invalid upstream contact')
                ports = {p for s in store.servers() for p in (s['port'], s['internal_port'])}
                require(values['web_port'] not in ports, 'Web port conflicts with a Minecraft port')
                previous_channel=store.settings().get('update_channel','stable')
                store.set_settings(data)
                if previous_channel!=values['update_channel']:
                    manager.updater.last_check=0;manager.updater.manifest=None;manager.updater.state={'status':'unchecked'}
                if values.get('dns_auto'):
                    from .domains import publish_all
                    manager.spawn_job(lambda: publish_all(manager))
                store.audit(self.user['username'], 'Changed global settings')
                self.reply({'saved': True, 'restart_required': values['web_port'] != self.server.server_port or values['bind_host'] != self.server.server_address[0] or (values['public_origin'] or None) != self.server.origin}); return
        if path == '/api/users':
            self.role('owner')
            if method == 'GET': self.reply([user_public(r) for r in store.rows('SELECT id,username,role,created,server_ids,avatar,permissions FROM users')]); return
            if method == 'POST':
                selected = validate_scope(store,data)
                from .permissions import validate_policy
                permissions=validate_policy(store,data.get('permissions'))
                user = store.add_user(data.get('username'), data.get('password'), data.get('role', 'viewer'))
                store.execute('UPDATE users SET server_ids=?,permissions=? WHERE id=?',(selected,permissions,user['id']))
                store.audit(self.user['username'], 'Created account ' + user['username'])
                self.reply(user, 201); return
        if len(self.parts) == 3 and self.parts[:2] == ['api', 'users'] and method in ('PUT', 'DELETE'):
            self.role('owner')
            uid = self.parts[2]
            rows = store.rows('SELECT * FROM users WHERE id=?', (uid,)); require(rows, 'Account not found', 404)
            require(rows[0]['role'] != 'owner' and uid != self.user['id'], 'Cannot modify the owner or your own account here', 403)
            if method == 'DELETE': store.execute('DELETE FROM users WHERE id=?', (uid,))
            else:
                role = data.get('role', rows[0]['role'])
                require(role in ('admin', 'operator', 'viewer'), 'Invalid role')
                hashed = password_hash(data['password']) if data.get('password') else rows[0]['password']
                selected = validate_scope(store,data) if 'server_ids' in data else rows[0]['server_ids']
                from .permissions import validate_policy
                permissions=validate_policy(store,data['permissions']) if 'permissions' in data else rows[0]['permissions']
                store.execute('UPDATE users SET role=?,password=?,server_ids=?,permissions=? WHERE id=?', (role, hashed, selected, permissions, uid))
            store.execute('DELETE FROM sessions WHERE user_id=?', (uid,))
            from .launcher import revoke_user
            revoke_user(store,uid)
            store.audit(self.user['username'], method + ' account ' + rows[0]['username'])
            self.reply({'ok': True}); return
        if path == '/api/audit' and method == 'GET':
            self.role('admin'); self.reply(store.rows('SELECT * FROM audit ORDER BY id DESC LIMIT 200')); return
        if len(self.parts) >= 3 and self.parts[:2] == ['api', 'servers']:
            sid = self.parts[2]
            action = self.parts[3] if len(self.parts) == 4 else ''
            if not action and method == 'GET': self.reply(manager.public(manager.active(sid))); return
            if action == 'history' and method == 'GET': self.reply(manager.history(sid, int(self.query.get('hours', 24)))); return
            if action == 'logs' and method == 'GET':
                self.role('operator'); manager.active(sid); self.reply({'lines': list(manager.logs.get(sid, []))}); return
            if action == 'files' and method == 'GET':
                self.role('operator'); self.reply(manager.files(sid, self.query.get('path', ''))); return
            if action == 'properties' and method == 'GET':
                self.role('operator'); self.reply({'values': manager.properties(sid), 'managed': sorted(PROTECTED_PROPERTIES)}); return
            require(method in ('POST', 'PUT') or (method == 'DELETE' and action == 'files'), 'Not found', 404)
            self.role('operator' if action in ('start', 'stop', 'sleep', 'kill', 'restart', 'command') else 'admin')
            if action == 'start': result = manager.start(sid)
            elif action == 'stop': result = manager.stop(sid)
            elif action == 'restart': result = manager.restart(sid)
            elif action == 'sleep': result = manager.sleep_now(sid)
            elif action == 'kill': result = manager.kill(sid)
            elif action == 'command': result = manager.command(sid, data.get('command'))
            elif action == 'archive': result = manager.archive(sid, True)
            elif action == 'unarchive': result = manager.archive(sid, False)
            elif action == 'configure': result = manager.configure(sid, data)
            elif action == 'update': result = manager.update_server(sid, data)
            elif action == 'mods-install': result = manager.mod_install(sid, data['version_id'])
            elif action == 'mods-toggle': result = manager.toggle_mod(sid, data['project_id'], data['enabled'])
            elif action == 'mods-icons': result = manager.mod_icons(sid)
            elif action == 'pack-install': result = manager.install_pack(sid, data['version_id'])
            elif action == 'check-updates': result = manager.check_updates(sid)
            elif action == 'files':
                result = manager.delete_file(sid, data['path'], data.get('directory', False)) if method == 'DELETE' else manager.write_file(sid, data['path'], data['content'])
            elif action == 'properties':
                with manager.locks[sid]:
                    s = manager.idle(sid); manager.write_properties(s, data['values'])
                result = {'saved': True}
            else: raise Problem('Not found', 404)
            store.audit(self.user['username'], action + ' server ' + sid)
            self.reply(result); return
        raise Problem('Not found', 404)
