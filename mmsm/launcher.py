"""Account-bound, one-use launcher pairing and revocable browser sessions."""
import hashlib
import re
import secrets
import time
from .store import require
from .web_features import user_public

PAIR_LIFETIME = 600
ACCESS_LIFETIME = 30 * 86400

def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()

def initialize(store):
    with store.lock, store.db:
        store.db.executescript('''
        CREATE TABLE IF NOT EXISTS launcher_pairings(token TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS launcher_connections(id TEXT PRIMARY KEY,token TEXT UNIQUE NOT NULL,user_id TEXT NOT NULL,label TEXT NOT NULL,created REAL NOT NULL,expires REAL NOT NULL,last_used REAL);
        ''')
        if 'launcher_id' not in {r[1] for r in store.db.execute('PRAGMA table_info(sessions)')}:
            store.db.execute('ALTER TABLE sessions ADD COLUMN launcher_id TEXT')
        if not store.db.execute("SELECT 1 FROM settings WHERE key='_launcher_instance_id'").fetchone():
            import json
            store.db.execute('INSERT INTO settings VALUES(?,?)',('_launcher_instance_id',json.dumps(secrets.token_hex(16))))

def revoke_user(store, uid):
    with store.lock, store.db:
        store.db.execute('DELETE FROM launcher_pairings WHERE user_id=?',(uid,))
        store.db.execute('DELETE FROM launcher_connections WHERE user_id=?',(uid,))
        store.db.execute('DELETE FROM sessions WHERE user_id=? AND launcher_id IS NOT NULL',(uid,))

def issue_session(store, uid, connection_id, expires):
    user = store.rows('SELECT id,username,role,avatar,server_ids,permissions FROM users WHERE id=?',(uid,))
    require(user,'Connection is no longer available. Generate a new token in MMSM.',401)
    token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    with store.lock, store.db:
        require(store.db.execute('SELECT 1 FROM launcher_connections WHERE id=? AND user_id=? AND expires>?',(connection_id,uid,time.time())).fetchone(),'Launcher connection expired or revoked',401)
        store.db.execute('DELETE FROM sessions WHERE launcher_id=?',(connection_id,))
        store.db.execute('INSERT INTO sessions(token,user_id,csrf,expires,launcher_id) VALUES(?,?,?,?,?)',
                         (digest(token),uid,csrf,min(expires,time.time()+86400),connection_id))
    return user_public(user[0]),token

def public_route(h):
    store=h.server.manager.store;path=h.url.path;method=h.command
    if path=='/api/launcher/info' and method=='GET':
        h.reply({'product':'MMSM','protocol':1,'instance_id':store.settings()['_launcher_instance_id']});return True
    if path not in ('/api/launcher/connect','/api/launcher/session','/api/launcher/disconnect') or method!='POST':return False
    h.rate_limit()
    now=time.time()
    if path=='/api/launcher/connect':
        pairing=h.data.get('token','')
        require(isinstance(pairing,str) and re.fullmatch(r'mml_pair_[A-Za-z0-9_-]{43}',pairing),'Invalid or expired connection token',401)
        access='mml_access_'+secrets.token_urlsafe(32);cid=secrets.token_hex(12);expires=now+ACCESS_LIFETIME
        with store.lock,store.db:
            row=store.db.execute('SELECT user_id FROM launcher_pairings WHERE token=? AND expires>?',(digest(pairing),now)).fetchone()
            require(row,'Invalid or expired connection token',401)
            require(store.db.execute('SELECT 1 FROM users WHERE id=?',(row['user_id'],)).fetchone(),'Account is no longer available',401)
            store.db.execute('DELETE FROM launcher_pairings WHERE token=?',(digest(pairing),))
            store.db.execute('INSERT INTO launcher_connections VALUES(?,?,?,?,?,?,?)',(cid,digest(access),row['user_id'],'MML on Windows',now,expires,now))
        user,cookie=issue_session(store,row['user_id'],cid,expires)
        store.audit(user['username'],'Connected MML launcher '+cid)
        h.reply({'user':user,'access_token':access,'expires':expires,'connection_id':cid,'instance_id':store.settings()['_launcher_instance_id']},headers={'Set-Cookie':h.session_cookie_header(cookie)})
        return True
    authorization=h.headers.get('Authorization','')
    require(re.fullmatch(r'Bearer mml_access_[A-Za-z0-9_-]{43}',authorization),'Launcher connection required',401)
    rows=store.rows('SELECT * FROM launcher_connections WHERE token=? AND expires>?',(digest(authorization[7:]),now))
    require(rows,'Launcher connection expired or revoked. Generate a new token in MMSM.',401)
    row=rows[0]
    if path=='/api/launcher/disconnect':
        with store.lock,store.db:
            store.db.execute('DELETE FROM launcher_connections WHERE id=?',(row['id'],))
            store.db.execute('DELETE FROM sessions WHERE launcher_id=?',(row['id'],))
        h.reply({'disconnected':True});return True
    user,cookie=issue_session(store,row['user_id'],row['id'],row['expires'])
    store.execute('UPDATE launcher_connections SET last_used=? WHERE id=?',(now,row['id']))
    h.reply({'user':user,'expires':row['expires'],'connection_id':row['id'],'instance_id':store.settings()['_launcher_instance_id']},headers={'Set-Cookie':h.session_cookie_header(cookie)})
    return True

def account_route(h):
    store=h.server.manager.store;path=h.url.path;method=h.command;uid=h.user['id'];now=time.time()
    if path=='/api/launcher/connections' and method=='GET':
        h.reply(store.rows('SELECT id,label,created,expires,last_used FROM launcher_connections WHERE user_id=? AND expires>? ORDER BY created DESC',(uid,now)));return True
    if path=='/api/launcher/pairings' and method=='POST':
        h.rate_limit()
        require(not store.rows('SELECT launcher_id FROM sessions WHERE token=? AND launcher_id IS NOT NULL',(digest(h.session_token),)), 'Generate connection tokens from your browser account, not a connected launcher',403)
        token='mml_pair_'+secrets.token_urlsafe(32)
        with store.lock,store.db:
            store.db.execute('DELETE FROM launcher_pairings WHERE user_id=? OR expires<?',(uid,now))
            store.db.execute('INSERT INTO launcher_pairings VALUES(?,?,?)',(digest(token),uid,now+PAIR_LIFETIME))
        h.reply({'token':token,'expires':now+PAIR_LIFETIME,'instance_url':h.request_origin},201);return True
    if path.startswith('/api/launcher/connections/') and method=='DELETE':
        cid=path.rsplit('/',1)[-1]
        with store.lock,store.db:
            removed=store.db.execute('DELETE FROM launcher_connections WHERE id=? AND user_id=?',(cid,uid)).rowcount
            require(removed,'Connection not found',404)
            store.db.execute('DELETE FROM sessions WHERE launcher_id=?',(cid,))
        h.reply({'revoked':True});return True
    return False
