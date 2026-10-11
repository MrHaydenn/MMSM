"""Central identity adapter. Local MMSM roles and server scopes remain authoritative."""
import json
import time
from pathlib import Path
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from .store import Problem, require

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None

def config(store):
    path = store.root / 'account-service.json'
    if not path.exists():
        return None
    value = json.loads(path.read_text())
    url = urlsplit(value['url'])
    require(url.scheme == 'https' or (url.scheme == 'http' and url.hostname in ('localhost', '127.0.0.1', '::1')), 'Account service requires HTTPS', 503)
    require(not url.username and not url.password and not url.query and not url.fragment and url.path in ('', '/'), 'Invalid account service URL', 503)
    return value

def request(store, route, data, authenticated=True, configuration=None):
    cfg = configuration or config(store)
    require(cfg, 'Central accounts are not configured', 503)
    headers = {'Content-Type': 'application/json'}
    if authenticated:
        headers['Authorization'] = 'Bearer ' + cfg['key']
    req = Request(cfg['url'].rstrip('/') + '/api/' + route, json.dumps(data).encode(), headers)
    try:
        with build_opener(NoRedirect).open(req, timeout=8) as response:
            body = response.read(65537)
            require(len(body) <= 65536, 'Invalid account service response', 503)
            return json.loads(body)
    except HTTPError as error:
        raise Problem('Account sign-in expired, disabled, or access denied' if error.code in (401, 403) else 'Account service unavailable', 401 if error.code in (401, 403) else 503)
    except (URLError, OSError, ValueError):
        raise Problem('Account service unavailable. Try again when it is online.', 503)

def authenticate(store, username, password):
    cfg = config(store)
    result = request(store, 'login', {'username': username, 'password': password, 'audience': cfg['client_id']}, False)
    return result['user']

def status(store, uid, version):
    if config(store):
        result = request(store, 'subject', {'id': uid, 'version': version})
        store.execute('UPDATE users SET username=? WHERE id=?', (result['user']['username'], uid))

def exchange(h):
    store = h.server.manager.store
    if h.url.path != '/api/launcher/identity' or h.command != 'POST':
        return False
    h.rate_limit()
    result = request(store, 'introspect', {'token': h.data.get('identity_token')})
    identity = provision(store, result['user'])
    import secrets, time
    from .launcher import digest, issue_session, ACCESS_LIFETIME
    access = 'mml_access_' + secrets.token_urlsafe(32)
    cid = secrets.token_hex(12)
    expires = time.time() + ACCESS_LIFETIME
    store.execute('INSERT INTO launcher_connections(id,token,user_id,label,created,expires,last_used,identity_version) VALUES(?,?,?,?,?,?,?,?)',
                  (cid, digest(access), identity['id'], 'MML shared account', time.time(), expires, time.time(), identity['version']))
    user, cookie = issue_session(store, identity['id'], cid, expires)
    h.reply({'user': user, 'access_token': access, 'expires': expires, 'instance_id': store.settings()['_launcher_instance_id']}, headers={'Set-Cookie': h.session_cookie_header(cookie)})
    return True


def provision(store, identity):
    """An authenticated shared identity starts with no server permissions."""
    rows = store.rows('SELECT id FROM users WHERE id=?', (identity['id'],))
    if not rows:
        with store.lock, store.db:
            store.db.execute('INSERT OR IGNORE INTO users(id,username,password,role,created,server_ids) VALUES(?,?,?,?,?,?)',
                (identity['id'], identity['username'], 'central-identity-only', 'viewer', time.time(), '[]'))
    return identity
