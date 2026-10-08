"""Server capabilities, with legacy role defaults and creator ownership."""
import json
from .store import require

CAPABILITIES = {
 'power':'Start, stop, restart, sleep and kill', 'console':'View console and crash logs', 'commands':'Send console commands',
 'files':'View files', 'edit_files':'Upload, edit and delete files', 'properties':'View properties', 'edit_properties':'Edit properties',
 'players':'View players', 'manage_players':'Manage whitelist, bans and operators', 'mods':'View mods and plugins',
 'manage_mods':'Install and manage mods/plugins', 'backups':'View backups and schedules', 'manage_backups':'Create backups and manage backup rules/schedules',
 'settings':'Change server settings and icon', 'runtime':'Update Minecraft/loader', 'archive':'Archive and restore server',
 'delete':'Delete server', 'sync':'Manage syncs (full server content)', 'address':'Manage public address', 'analytics':'View historical analytics',
 'downloads':'View download history'}

def decode(value):
    return json.loads(value) if isinstance(value,str) else value

def role_defaults(role):
    if role in ('owner','admin'):return dict.fromkeys(CAPABILITIES,True)
    allowed={'players','analytics'} | ({'power','console','commands','files','properties','downloads'} if role=='operator' else set())
    return {key:key in allowed for key in CAPABILITIES}

def policy(user):return decode(user.get('permissions')) or {}

def creator_allowed(user):
    if user['role']=='owner':return True
    value=policy(user)
    return value.get('create_servers',user['role']=='admin' and user.get('server_ids') is None)

def visible(user, server):
    if user['role']=='owner' or server.get('created_by')==user['id']:return True
    ids=decode(user.get('server_ids'))
    return ids is None or server['id'] in ids

def capabilities(user,server):
    if user['role']=='owner' or server.get('created_by')==user['id']:return dict.fromkeys(CAPABILITIES,True)
    if not visible(user,server):return dict.fromkeys(CAPABILITIES,False)
    value=policy(user);defaults=role_defaults(user['role'])
    defaults.update(value.get('server') or {})
    defaults.update(value.get('overrides',{}).get(server['id'],{}))
    return defaults

def validate_policy(store,value):
    if value is None:return None
    require(isinstance(value,dict) and set(value)<= {'create_servers','server','overrides'},'Invalid account permissions')
    require(type(value.get('create_servers',False)) is bool,'Invalid creation permission')
    def flags(data):
        require(isinstance(data,dict) and set(data)<=set(CAPABILITIES) and all(type(v) is bool for v in data.values()),'Invalid server permissions')
        return data
    server=value.get('server'); flags(server) if server is not None else None
    overrides=value.get('overrides',{})
    require(isinstance(overrides,dict) and len(overrides)<=10000,'Invalid server overrides')
    ids={s['id'] for s in store.servers()}
    require(set(overrides)<=ids,'Unknown server permission override')
    for data in overrides.values():flags(data)
    return json.dumps({'create_servers':value.get('create_servers',False),'server':server,'overrides':overrides})

def request_server(h):
    if h.parts[:2]==['api','servers'] and len(h.parts)>=3:return h.parts[2]
    if h.url.path.startswith('/api/modrinth/') or h.url.path=='/api/catalog':return h.query.get('server_id')
    return None

def authorize(h,sid):
    server=h.server.manager.store.server(sid)
    require(visible(h.user,server),'Server not found',404)
    flags=capabilities(h.user,server);action=h.parts[3] if h.parts[:2]==['api','servers'] and len(h.parts)==4 else ''
    read=h.command=='GET'
    if h.url.path.startswith('/api/modrinth/'):permission='mods'
    elif h.url.path=='/api/catalog':permission='runtime'
    elif not action:permission=None if read else 'delete'
    else:
        permission={
          'history':'analytics','logs':'console','error-report':'console','command':'commands',
          'start':'power','stop':'power','restart':'power','kill':'power','sleep':'power',
          'files':'files' if read else 'edit_files','upload':'edit_files',
          'properties':'properties' if read else 'edit_properties',
          'players':'players' if read else 'manage_players','head':'players',
          'backups':'backups' if read else 'manage_backups',
          'configure':'settings','icon':None if read else 'settings','update':'runtime',
          'archive':'archive','unarchive':'archive','address':'address','syncs':'sync','sync-now':'sync',
          'sync-edit':None,'project-install':'manage_mods','mods-upload':'manage_mods','mods-install':'manage_mods',
          'pack-install':'manage_mods','mods-toggle':'manage_mods','mods-icons':'mods','check-updates':'manage_mods'}.get(action,'UNKNOWN')
        if action=='sync-edit':require(any(flags[k] for k in ('edit_files','manage_mods','settings','runtime','edit_properties')),'Permission denied',403)
    require(permission is None or flags.get(permission,False),'Your account does not have permission for this action',403)
    if action=='backups' and not read:
        # Backup scheduling must not become a back door to power controls.
        for item in h.data.get('schedules',[]):
            if item.get('action')!='backup':require(flags['power'],'Power permission is required for server-control schedules',403)
        if h.user['role']!='owner' and not (h.user['role']=='admin' and h.user.get('server_ids') is None):
            from pathlib import Path
            default=(h.server.manager.store.project_root/'Backups'/server.get('directory',sid)).resolve()
            require(all(not r.get('path') or Path(r['path']).resolve()==default for r in h.data.get('backup_rules',[])),'Delegated accounts use the default server backup location',403)
    h.server_authorized=True
    return flags

def public_server(h,value):
    result=dict(value);flags=capabilities(h.user,value)
    result['permissions']=flags;result['owned']=value.get('created_by')==h.user['id']
    if not flags['mods']:result['mods']=[];result.pop('modpack',None)
    if not flags['settings']:result.pop('jvm_args',None)
    if not flags['backups']:
        for key in ('backup_rules','schedules','backup_result','last_backup'):result.pop(key,None)
    return result

def any_capability(h,key):
    return any(capabilities(h.user,s)[key] for s in h.server.manager.store.servers() if visible(h.user,s))
