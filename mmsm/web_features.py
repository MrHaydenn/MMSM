"""Authorization and routes shared by the expanded manager UI."""
import json
from pathlib import Path
import re
import time
from .store import require, atomic_write, confined
from .images import image_bytes, minecraft_head


def scope(handler):
    user=handler.user
    if user['role']=='owner' or user.get('server_ids') is None:return None
    return json.loads(user['server_ids'])


def can_see(handler,sid):
    allowed=scope(handler)
    return allowed is None or sid in allowed


def enforce_scope(handler):
    sid=None
    if handler.parts[:2]==['api','servers'] and len(handler.parts)>=3:sid=handler.parts[2]
    elif handler.url.path.startswith('/api/modrinth/'):sid=handler.query.get('server_id')
    if sid:require(can_see(handler,sid),'Server not found',404)
    # Scoped admins manage their own servers, not global identity/settings policy.
    if handler.url.path.startswith(('/api/users','/api/settings','/api/audit')):
        require(scope(handler) is None,'Global administration requires an unrestricted administrator',403)


def user_public(row):
    return {k:row[k] for k in ('id','username','role','created','avatar') if k in row} | {'server_ids':json.loads(row['server_ids']) if row.get('server_ids') is not None else None}


def validate_scope(store,data):
    ids=data.get('server_ids')
    if ids is None:return None
    require(isinstance(ids,list) and len(ids)<=10000 and all(isinstance(v,str) for v in ids),'Invalid server selection')
    require(set(ids)<={s['id'] for s in store.servers()},'Unknown server selected')
    return json.dumps(sorted(set(ids)))


def notification_rows(h):
    store=h.server.manager.store
    return [dict(row,payload=json.loads(row['payload']),seen=int(bool(row['read_id']))) for row in store.rows(
        'SELECT n.*, r.notification_id AS read_id FROM notifications n LEFT JOIN notification_reads r ON r.notification_id=n.id AND r.user_id=? ORDER BY n.created DESC',(h.user['id'],))
        if (row['server_id'] is None and scope(h) is None or row['server_id'] and can_see(h,row['server_id']) and not store.server(row['server_id'])['archived'])][:100]


def extra_route(h):
    manager=h.server.manager;store=manager.store;path=h.url.path;method=h.command;data=h.data
    if len(h.parts)==4 and h.parts[:2]==['api','servers'] and h.parts[3] in ('syncs','sync-edit','sync-now','address'):
        h.role('admin'); sid, action=h.parts[2:]; server=manager.active(sid)
        if action=='address':
            from .domains import plan, save
            if method=='GET': h.reply(plan(store.settings(),server))
            elif method=='PUT': h.reply(save(manager,sid,data))
            else: return False
        elif action=='sync-edit' and method=='POST': h.reply({'ready':True})
        elif action=='syncs' and method=='GET':
            sources=[{'id':s['id'],'name':s['name'],'loader':s['loader'],'minecraft':s['minecraft'],'folders':[p.name for p in manager.folder(s['id']).iterdir() if p.is_dir() and not p.is_symlink()]} for s in store.servers(False) if s['id']!=sid and can_see(h,s['id']) and not s.get('sync')]
            rule=server.get('sync')
            if rule and not can_see(h,rule['source_id']): rule={'status':'Source is outside your account access'}
            h.reply({'rule':rule,'sources':sources})
        elif action=='syncs' and method=='PUT':
            if data.get('source_id'): require(can_see(h,data['source_id']),'Source server not found',404)
            h.reply(manager.syncs.save(sid,data))
        elif action=='sync-now' and method=='POST':
            require(can_see(h,server.get('sync',{}).get('source_id')),'Source server not found',404)
            h.reply(manager.syncs.run(sid))
        else: return False
        store.audit(h.user['username'],method+' '+action+' '+sid) if method!='GET' else None
        return True
    if path.startswith('/api/wrapper-update/'):
        h.role('admin');require(scope(h) is None,'Global administrator required',403)
        if path=='/api/wrapper-update/check' and method=='POST':h.reply(manager.updater.check());return True
        if path=='/api/wrapper-update/install' and method=='POST':
            result=manager.updater.prepare();h.reply(result)
            __import__('threading').Thread(target=manager.updater.shutdown,daemon=True).start();return True
        if path=='/api/wrapper-update/status' and method=='GET':h.reply(manager.updater.status());return True
        return False
    if len(h.parts)==4 and h.parts[:2]==['api','servers'] and h.parts[3]=='error-report' and method=='GET':
        h.role('operator');h.reply({'text':manager.error_report(h.parts[2])});return True
    if path=='/api/analytics' and method=='GET':
        h.reply(manager.usage_history(int(h.query.get('days',7)),scope(h)));return True
    if path=='/api/download-history' and method=='GET':
        h.role('operator');h.reply(store.download_history(scope(h),page=int(h.query.get('page',0))));return True
    if path=='/api/modrinth/compatible' and method=='GET':
        h.role('admin')
        versions=manager.compatible_project_versions(h.query['server_id'],h.query['project'],h.query.get('type','mod'))
        h.reply({'versions':versions,'latest_id':versions[0]['id'] if versions else None});return True
    if len(h.parts)==3 and h.parts[:2]==['api','servers'] and method=='DELETE':
        h.role('admin');h.reply(manager.delete_server(h.parts[2],data.get('confirm_name')));return True
    if len(h.parts)==4 and h.parts[:2]==['api','servers'] and h.parts[3]=='project-install' and method=='POST':
        h.role('admin');h.reply(manager.install_project(h.parts[2],data));return True
    if path=='/api/appearance' and method=='GET':
        file=store.root/'images'/'logo.png'
        h.reply({'theme':store.settings().get('theme','forest'),'logo':file.is_file(),'logo_revision':str(file.stat().st_mtime_ns) if file.is_file() else 'default'});return True
    if path=='/api/profile' and method=='POST':
        png=image_bytes(__import__('base64').b64decode(data['image'],validate=True),128) if data.get('image') else minecraft_head(manager,data.get('minecraft_name',''))
        atomic_write(store.root/'images'/'avatars'/(h.user['id']+'.png'),png)
        store.execute('UPDATE users SET avatar=? WHERE id=?',(int(time.time()),h.user['id']))
        h.reply({'saved':True});return True
    if path=='/api/assets/avatar' and method=='GET':
        file=store.root/'images'/'avatars'/(h.user['id']+'.png')
        h.reply(file.read_bytes(),content_type='image/png');return True
    if path=='/api/assets/logo':
        file=store.root/'images'/'logo.png'
        if method=='POST':
            h.role('admin');require(scope(h) is None,'Global administrator required',403)
            atomic_write(file,image_bytes(__import__('base64').b64decode(data['image'],validate=True),128));h.reply({'saved':True})
        elif method=='GET':h.reply(file.read_bytes(),content_type='image/png')
        else:return False
        return True
    if path=='/api/notifications' and method=='GET':h.reply(notification_rows(h));return True
    if path=='/api/notifications/read' and method=='POST':
        for row in notification_rows(h):store.execute('INSERT OR IGNORE INTO notification_reads VALUES(?,?)',(h.user['id'],row['id']))
        h.reply({'ok':True});return True
    if path=='/api/notifications/action' and method=='POST':
        h.role('admin')
        row=next((r for r in notification_rows(h) if r['id']==data.get('id')),None)
        require(row,'Notification not found',404);require(row['kind']=='whitelist','This notification has no whitelist action')
        require(data.get('action') in ('whitelist','ignore'),'Invalid notification action')
        result={}
        if data['action']=='whitelist':result=manager.player_action(row['server_id'],{'name':row['payload']['name'],'action':'whitelist'})
        # Queued commands remain pending until the player list confirms acceptance.
        if not result.get('queued'):
            store.execute('UPDATE notifications SET resolved=1 WHERE id=?',(row['id'],))
        store.audit(h.user['username'],data['action']+' join request '+row['payload']['name'])
        h.reply(result or {'resolved':True});return True
    if len(h.parts)==4 and h.parts[:2]==['api','servers']:
        sid,action=h.parts[2:]
        if action not in ('icon','head','players','backups'):return False
        manager.active(sid)
        if action=='icon':
            file=confined(manager.folder(sid),'server-icon.png')
            if method=='GET':h.reply(file.read_bytes(),content_type='image/png')
            elif method=='POST':
                h.role('admin')
                with manager.locks[sid]:
                    manager.idle(sid)
                    atomic_write(file,image_bytes(__import__('base64').b64decode(data['image'],validate=True),64))
                h.reply({'saved':True})
            else:return False
            return True
        if action=='head' and method=='GET':
            # Only allow names already known to this server; no anonymous proxy endpoint.
            name=h.query.get('name','');known=manager.players(sid)
            require(any(p['name'].lower()==name.lower() for p in known['players']) or any(r['payload'].get('name','').lower()==name.lower() for r in known['requests']),'Player not found',404)
            h.reply(minecraft_head(manager,name),content_type='image/png');return True
        if action=='players':
            if method=='GET':
                result=manager.players(sid)
                accepted={p['name'].lower() for p in result['players'] if p.get('whitelisted')}
                for row in result['requests']:
                    if row['payload']['name'].lower() in accepted:store.execute('UPDATE notifications SET resolved=1 WHERE id=?',(row['id'],))
                result['requests']=[r for r in result['requests'] if r['payload']['name'].lower() not in accepted]
                h.reply(result)
            elif method=='POST':h.role('admin');h.reply(manager.player_action(sid,data))
            else:return False
            return True
        if action=='backups':
            h.role('admin')
            if method=='GET':h.reply({'rules':manager.active(sid).get('backup_rules',[]),'schedules':manager.active(sid).get('schedules',[]),'history':store.rows('SELECT * FROM backup_records WHERE server_id=? ORDER BY created DESC',(sid,))})
            elif method=='PUT':h.reply(manager.backup_settings(sid,data))
            elif method=='POST':h.reply(manager.queue_backup(sid,data.get('rule_id')))
            else:return False
            return True
    return False
