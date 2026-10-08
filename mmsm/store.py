import contextlib
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import sqlite3
import threading
import time


class Problem(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def require(condition, message, status=400):
    if not condition:
        raise Problem(message, status)


def confined(root, relative):
    root = Path(root).resolve()
    require(isinstance(relative, str) and '\\' not in relative and '\x00' not in relative, 'Invalid path')
    p = root / relative
    require(not Path(relative).is_absolute() and '..' not in Path(relative).parts, 'Path escapes server folder')
    require(p.resolve().is_relative_to(root), 'Path escapes server folder')
    # Disallow symlinks even if they currently resolve within the root.
    for parent in [p, *p.parents]:
        if parent == root:
            break
        require(not parent.is_symlink(), 'Symlink access is disabled')
    return p


def atomic_write(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + '.' + secrets.token_hex(6) + '.tmp')
    try:
        tmp.write_bytes(data if isinstance(data, bytes) else data.encode('utf-8'))
        os.replace(tmp, path)
    finally:
        tmp.unlink(missing_ok=True)


def password_hash(password, salt=None):
    require(isinstance(password, str) and 12 <= len(password) <= 256, 'Password must be 12–256 characters')
    salt = salt or secrets.token_hex(16)
    return salt + ':' + hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()


def password_matches(password, stored):
    try:
        return hmac.compare_digest(password_hash(password, stored.split(':')[0]), stored)
    except (ValueError, Problem):
        return False


GITHUB_EXPERIMENTAL_FEED = 'https://github.com/MrHaydenn/MMSM/releases/download/experimental/latest.json'

GITHUB_UPDATE_FEED = 'https://github.com/MrHaydenn/MMSM/releases/latest/download/latest.json'

DEFAULTS = {'bind_host':'0.0.0.0', 'public_origin':'', 'web_port': 11015, 'default_loader': 'fabric', 'default_memory_mb': 4096,
            'default_sleep': False, 'idle_minutes': 15, 'retention_days': 30,
            'dns_auto': False, 'dns_zone_id': '', 'dns_token': '', 'dns_zone': '', 'dns_base': '', 'dns_ip': '', 'theme': 'forest', 'update_channel': 'stable', 'update_feed': GITHUB_UPDATE_FEED, 'wrapper_update_checks': True, 'update_interval_hours': 6, 'upstream_contact': '', 'auto_eula': True,
            'accent_color': '#a6ec80', 'background_color': '#0b1010', 'panel_color': '#111918', 'navbar_color': '#101817', 'hover_color': '#24342c'}


class Store:
    def __init__(self, root, project_root=None):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self.project_root = Path(project_root or root).resolve()
        self.servers_root = self.project_root / "Servers"
        self.servers_root.mkdir(parents=True, exist_ok=True)
        for name in ('servers', 'backups', 'java', 'downloads'):
            (self.root / name).mkdir(exist_ok=True)
        self.lock = threading.RLock()
        self.dummy_password = password_hash('unavailable-password', '00' * 16)
        self.db = sqlite3.connect(self.root / 'mmsm.sqlite3', check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.executescript('''
        CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, username TEXT UNIQUE COLLATE NOCASE,
          password TEXT NOT NULL, role TEXT NOT NULL, created REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id TEXT NOT NULL, csrf TEXT NOT NULL, expires REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS servers(id TEXT PRIMARY KEY, data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS downloads(id TEXT PRIMARY KEY, data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY, server_id TEXT, message TEXT, seen INTEGER DEFAULT 0, created REAL, dedupe TEXT UNIQUE);
        CREATE TABLE IF NOT EXISTS metrics(id INTEGER PRIMARY KEY, server_id TEXT, ts REAL NOT NULL, data TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS metrics_lookup ON metrics(server_id, ts);
        CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, ts REAL, username TEXT, action TEXT);
        CREATE TABLE IF NOT EXISTS dismissed_downloads(user_id TEXT NOT NULL, download_id TEXT NOT NULL,
          PRIMARY KEY(user_id, download_id));
        ''')
        for table, column, definition in [('users','server_ids','TEXT'), ('users','avatar','INTEGER DEFAULT 0'),
                                           ('notifications','kind',"TEXT DEFAULT 'alert'"), ('notifications','payload',"TEXT DEFAULT '{}'"),
                                           ('notifications','resolved','INTEGER DEFAULT 0')]:
            if column not in {r[1] for r in self.db.execute('PRAGMA table_info(' + table + ')')}:
                self.db.execute('ALTER TABLE ' + table + ' ADD COLUMN ' + column + ' ' + definition)
        self.db.executescript("""
        CREATE TABLE IF NOT EXISTS usage_hourly(server_id TEXT NOT NULL, bucket INTEGER NOT NULL,
          player_seconds REAL DEFAULT 0, rx_bytes REAL DEFAULT 0, tx_bytes REAL DEFAULT 0,
          observed_seconds REAL DEFAULT 0, peak_players INTEGER DEFAULT 0, PRIMARY KEY(server_id,bucket));
        CREATE TABLE IF NOT EXISTS server_deletions(id TEXT PRIMARY KEY, original TEXT NOT NULL, tombstone TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS backup_records(id TEXT PRIMARY KEY, server_id TEXT, rule_id TEXT, path TEXT, created REAL);
        CREATE TABLE IF NOT EXISTS notification_reads(user_id TEXT, notification_id TEXT, PRIMARY KEY(user_id,notification_id));
        """)
        # One-time migration of the former default, preserving genuinely custom ports.
        if not self.db.execute("SELECT 1 FROM settings WHERE key='_port_11015_migrated'").fetchone():
            self.db.execute("UPDATE settings SET value='11015' WHERE key='web_port' AND value='3000'")
            self.db.execute("INSERT INTO settings(key,value) VALUES('_port_11015_migrated','true')")
        # Bootstrap older installs that had no release host; preserve custom feeds.
        if not self.db.execute("SELECT 1 FROM settings WHERE key='_github_feed_migrated'").fetchone():
            self.db.execute("UPDATE settings SET value=? WHERE key='update_feed' AND value=?",
                            (json.dumps(GITHUB_UPDATE_FEED), json.dumps('')))
            self.db.execute("INSERT INTO settings(key,value) VALUES('_github_feed_migrated','true')")
        self.db.commit()
        with contextlib.suppress(OSError):
            os.chmod(self.root, 0o700)
            os.chmod(self.root / 'mmsm.sqlite3', 0o600)

    def rows(self, sql, args=()):
        with self.lock:
            return [dict(x) for x in self.db.execute(sql, args).fetchall()]

    def execute(self, sql, args=()):
        with self.lock, self.db:
            return self.db.execute(sql, args).rowcount

    def settings(self):
        return {**DEFAULTS, **{r['key']: json.loads(r['value']) for r in self.rows('SELECT * FROM settings')}}

    def set_settings(self, values):
        with self.lock, self.db:
            for k, v in values.items():
                self.db.execute('INSERT OR REPLACE INTO settings VALUES(?,?)', (k, json.dumps(v)))

    def servers(self, archive=None):
        items = [json.loads(r['data']) for r in self.rows('SELECT data FROM servers')]
        return [s for s in items if archive is None or s['archived'] == archive]

    def server(self, sid):
        rows = self.rows('SELECT data FROM servers WHERE id=?', (sid,))
        require(rows, 'Server not found', 404)
        return json.loads(rows[0]['data'])

    def save_server(self, server):
        self.execute('INSERT OR REPLACE INTO servers VALUES(?,?)', (server['id'], json.dumps(server)))

    def notify(self, sid, message, dedupe=None, kind="alert", payload=None):
        self.execute('INSERT OR IGNORE INTO notifications(id,server_id,message,seen,created,dedupe,kind,payload) VALUES(?,?,?,0,?,?,?,?)',
                     (secrets.token_hex(12), sid, message, time.time(), dedupe, kind, json.dumps(payload or {})))

    def audit(self, username, action):
        self.execute('INSERT INTO audit(ts,username,action) VALUES(?,?,?)', (time.time(), username, action))

    def add_user(self, username, password, role, first=False):
        import re
        require(isinstance(username, str) and re.fullmatch(r'[a-zA-Z0-9_.-]{3,32}', username), 'Username must be 3–32 letters, numbers, dots, underscores or hyphens')
        require(role in ('owner', 'admin', 'operator', 'viewer'), 'Invalid role')
        hashed = password_hash(password)
        with self.lock, self.db:
            if first:
                require(not self.db.execute('SELECT 1 FROM users LIMIT 1').fetchone(), 'Setup is already complete', 409)
            else:
                require(role != 'owner', 'Only the first account can be owner')
            uid = secrets.token_hex(12)
            try:
                self.db.execute('INSERT INTO users(id,username,password,role,created) VALUES(?,?,?,?,?)', (uid, username, hashed, role, time.time()))
            except sqlite3.IntegrityError:
                raise Problem('Username already exists', 409)
        return {'id': uid, 'username': username, 'role': role}

    def login(self, username, password):
        rows = self.rows('SELECT * FROM users WHERE username=?', (username,))
        # Same expensive KDF for unknown usernames to reduce enumeration timing.
        candidate = rows[0]['password'] if rows else self.dummy_password
        require(password_matches(password, candidate) and rows, 'Invalid username or password', 401)
        user = {k: rows[0][k] for k in ('id', 'username', 'role')}
        token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
        self.execute('INSERT INTO sessions VALUES(?,?,?,?)', (hashlib.sha256(token.encode()).hexdigest(), user['id'], csrf, time.time() + 86400))
        return user, token, csrf

    def session(self, token):
        rows = self.rows('SELECT users.id, username, role, csrf, server_ids, avatar FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND expires>?',
                         (hashlib.sha256(token.encode()).hexdigest(), time.time()))
        require(rows, 'Please sign in', 401)
        return rows[0]

    def prune_downloads(self,max_records=10000,max_bytes=16*1024**2,max_days=90):
        """Bound history metadata, never active transfers or downloaded files."""
        with self.lock,self.db:
            rows=self.db.execute("SELECT id,data,LENGTH(CAST(data AS BLOB)) AS size FROM downloads WHERE json_extract(data,'$.status') NOT IN ('queued','downloading') ORDER BY COALESCE(json_extract(data,'$.finished'),json_extract(data,'$.created'),0) DESC,rowid DESC").fetchall()
            size=0;kept=0;cutoff=time.time()-max_days*86400;remove=[]
            for row in rows:
                item=json.loads(row['data']);amount=row['size']
                if ((item.get('finished') or item.get('created')) is not None and (item.get('finished') or item.get('created'))<cutoff) or kept>=max_records or size+amount>max_bytes:remove.append((row['id'],))
                else:kept+=1;size+=amount
            self.db.executemany('DELETE FROM downloads WHERE id=?',remove)
            self.db.execute('DELETE FROM dismissed_downloads WHERE download_id NOT IN (SELECT id FROM downloads)')

    def download_history(self,allowed=None,user_id=None,page=None):
        rows=[json.loads(r['data']) for r in self.rows("SELECT data FROM downloads ORDER BY COALESCE(json_extract(data,'$.finished'),json_extract(data,'$.created'),0) DESC,rowid DESC")]
        rows=[r for r in rows if allowed is None or r.get('server_id') in allowed]
        if page is not None:
            require(type(page) is int and 0<=page<=10000,'Invalid history page')
            return {'items':rows[page*50:(page+1)*50],'total':len(rows),'page':page,'page_size':50,
                    'limits':{'records':10000,'bytes':16*1024**2,'days':90}}
        hidden={r['download_id'] for r in self.rows('SELECT download_id FROM dismissed_downloads WHERE user_id=?',(user_id,))}
        active=[r for r in rows if r['status'] in ('queued','downloading')]
        recent=[r for r in rows if r['status'] not in ('queued','downloading') and r['id'] not in hidden][:3]
        return active+recent
