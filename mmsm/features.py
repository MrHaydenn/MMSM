"""Server storage, players, release discovery and durable interval jobs."""
import contextlib
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import threading
import time
import uuid
import zipfile

from .store import require, Problem, atomic_write, confined
from .providers import version_key, FABRIC

UNITS = {'seconds': 1, 'minutes': 60, 'hours': 3600, 'days': 86400, 'weeks': 604800}
NAME = r'[A-Za-z0-9_]{1,16}'


from .maintenance import Maintenance


class Features(Maintenance):
    def initialize_features(self):
        self.recover_deletions()
        self.store.prune_downloads()
        self.online_names = {}
        self.schedule_running = set()
        self.operation_guards = set()
        # Persist destination before moving: restarting after an interrupted migration resumes it.
        for s in self.store.servers():
            old = self.store.root / 'servers' / s['id'] / 'runtime'
            if not s.get('directory'):
                s['directory'] = self.directory_name(s['name'], s['id'])
                s['migration_pending'] = True
                self.store.save_server(s)
            if s.get('migration_pending'):
                dest = confined(self.store.servers_root, s['directory'])
                require(not (old.exists() and dest.exists()), 'Storage migration conflict: ' + str(dest))
                require(not old.is_symlink(), 'Server storage migration cannot follow a symlink')
                if old.exists(): os.replace(old, dest)
                else: dest.mkdir(exist_ok=True)
                s.pop('migration_pending', None)
                self.store.save_server(s)
        # Older successful installation messages are no longer release notifications.
        self.store.execute("DELETE FROM notifications WHERE kind='alert' AND (message LIKE '% installed for Minecraft %' OR message LIKE 'Modpack installed:%')")

    def directory_name(self, name, sid):
        safe = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', name).strip(' .')[:64] or 'Server'
        if safe.split('.')[0].upper() in {'CON','PRN','AUX','NUL', *('COM'+str(i) for i in range(1,10)), *('LPT'+str(i) for i in range(1,10))}: safe = '_' + safe
        used = {s.get('directory','').casefold() for s in self.store.servers() if s['id'] != sid}
        own = next((s.get('directory') for s in self.store.servers() if s['id']==sid), None)
        if safe.casefold() in used or ((self.store.servers_root / safe).exists() and safe != own):
            safe += '-' + sid[:8]
        require(safe.casefold() not in used and (not (self.store.servers_root / safe).exists() or safe == own), 'Server directory already exists')
        return safe

    def rename_directory(self, s):
        old = self.folder(s['id'])
        name = self.directory_name(s['name'], s['id'])
        if s.get('directory') == name: return
        dest = confined(self.store.servers_root, name)
        require(not dest.exists(), 'Server directory already exists', 409)
        if old.exists(): os.replace(old, dest)
        else: dest.mkdir()
        previous = s.get('directory')
        s['directory'] = name
        try: self.store.save_server(s)
        except Exception:
            os.replace(dest, old)
            s['directory'] = previous
            raise

    def stable_catalog(self, loader, mc=None, experimental=False):
        result = self.providers.catalog(loader, mc)
        if experimental: return result
        # Minecraft release metadata is authoritative (including new year-based versions).
        releases = {v['id'] for v in self.providers.minecraft() if v.get('type') == 'release'}
        games = [v for v in result['minecraft'] if v in releases]
        versions = result['versions'] if not mc or mc in releases else []
        if loader == 'fabric' and mc:
            stable = {v['loader']['version'] for v in self.providers.get(FABRIC + '/versions/loader/' + mc) if v['loader'].get('stable') is True}
            versions = [v for v in versions if v in stable]
        elif loader == 'paper':
            versions = [v for v in versions if result.get('channels',{}).get(v) == 'STABLE']
        else:
            versions = [v for v in versions if not re.search(r'alpha|beta|snapshot|pre|rc|experimental', v, re.I)]
        return {**result, 'minecraft': games, 'versions': versions}

    def check_runtime_updates(self, sid):
        with self.locks[sid]:
            s = self.active(sid)
            catalog = self.stable_catalog(s['loader'], s['minecraft'])
            candidates = [v for v in catalog['minecraft'] if version_key(v) > version_key(s['minecraft'])]
            target = max(candidates, key=version_key) if candidates else s['minecraft']
            builds = self.stable_catalog(s['loader'], target)['versions'] if candidates else catalog['versions']
            # Some loader game catalogs are published before their usable server builds.
            if not builds: return
            latest = max(builds, key=version_key)
            if target != s['minecraft'] or version_key(latest) > version_key(s['loader_version']):
                s['runtime_update'] = {'minecraft': target, 'loader_version': latest}
                self.store.save_server(s)
                self.store.notify(sid, f'{s["name"]}: {s["loader"]} {latest} / Minecraft {target} is available',
                                  f'runtime:{sid}:{target}:{latest}', 'runtime', {'tab':'config', **s['runtime_update']})

    def restart(self, sid, automatic=False):
        with self.locks[sid]:
            self.active(sid)
            require(sid not in self.operation_guards, 'Another operation is in progress', 409)
            require(sid not in self.operation_guards, 'Wait for the current operation', 409)
            require(self.state(sid)['status'] in ('running','starting','stopped','sleeping','error','crashed'), 'Server is busy', 409)
            if automatic: require(not self.stop_requests[sid].is_set(), 'Restart cancelled by Stop',409)
            else: self.stop_requests[sid].clear()
            s = self.store.server(sid); s['manual_stop'] = False; self.store.save_server(s)
            self.operation_guards.add(sid)
        def run():
            try:
                self.stop(sid, internal=True)
                with self.locks[sid]:
                    self.operation_guards.discard(sid)
                    if not self.store.server(sid).get('manual_stop') and not self.stop_requests[sid].is_set(): self.start(sid, automatic=True)
            except Exception as e:
                if self.state(sid)['status'] != 'crashed' and not self.stop_requests[sid].is_set(): self.set_state(sid, status='error', error=str(e))
            finally: self.operation_guards.discard(sid)
        self.spawn_job(run)
        return {'queued': True}

    def read_players_file(self, sid, filename):
        path = confined(self.folder(sid), filename)
        if not path.exists(): return []
        require(path.stat().st_size <= 8*1024**2, 'Player list is too large')
        data = json.loads(path.read_text('utf-8'))
        require(isinstance(data, list), 'Invalid player list: ' + filename)
        return [r for r in data if isinstance(r,dict) and re.fullmatch(NAME,str(r.get('name','')))]

    def players(self, sid):
        self.active(sid)
        merged = {}
        for filename, flag in [('usercache.json','known'),('whitelist.json','whitelisted'),('banned-players.json','banned'),('ops.json','op')]:
            for row in self.read_players_file(sid, filename):
                key = row['name'].lower()
                merged.setdefault(key, {'name':row['name'], 'uuid':row.get('uuid','')})
                merged[key].update({flag:True})
                for k in ('reason','expires','level'): 
                    if k in row: merged[key][k] = row[k]
        if self.alive(sid):
            for name in list(self.online_names.get(sid,set())):
                merged.setdefault(name.lower(), {'name':name,'uuid':''})['online'] = True
        return {'players':sorted(merged.values(), key=lambda r:r['name'].lower()), 'online_count':self.state(sid).get('players'),
                'requests':[dict(r, payload=json.loads(r['payload'])) for r in self.store.rows("SELECT * FROM notifications WHERE server_id=? AND kind='whitelist' AND resolved=0", (sid,))]}

    def player_log(self, sid, line):
        joined = re.search(r'\b('+NAME+r') joined the game', line)
        left = re.search(r'\b('+NAME+r') left the game', line)
        names = self.online_names.setdefault(sid,set())
        if joined: names.add(joined.group(1))
        if left: names.discard(left.group(1))
        accepted = re.search(r'Added ('+NAME+r') to the whitelist',line)
        if accepted:self.store.execute("UPDATE notifications SET resolved=1 WHERE server_id=? AND dedupe=?", (sid,f'whitelist:{sid}:{accepted.group(1).lower()}'))
        if not re.search(r'not white.?listed|not on the whitelist', line, re.I): return
        match = re.search(r'name=('+NAME+r')[,\]]', line) or re.search(r'Disconnecting ('+NAME+r')\b',line) or re.search(r'\]: ('+NAME+r') (?:\([^\n]*?\) )?lost connection:',line)
        if match:
            name = match.group(1)
            self.store.notify(sid, name + ' tried to join but is not whitelisted', f'whitelist:{sid}:{name.lower()}', 'whitelist', {'name':name,'tab':'players'})

    def player_action(self, sid, data):
        with self.locks[sid]:
            self.active(sid)
            name, action = data.get('name',''), data.get('action')
            require(re.fullmatch(NAME,name), 'Use a valid Minecraft username')
            commands = {'whitelist':'whitelist add','unwhitelist':'whitelist remove','ban':'ban','pardon':'pardon','op':'op','deop':'deop'}
            require(action in commands, 'Unknown player action')
            require(sid not in self.operation_guards, 'Wait for the current operation', 409)
            require(self.state(sid)['status'] in ('running','starting','stopped','sleeping','error','crashed'), 'Server is busy', 409)
            if self.alive(sid):
                self.command(sid, commands[action] + ' ' + name)
                return {'queued':True, 'message':'Command sent. Minecraft validates the name; player files refresh after it completes.'}
            filename, add = {'whitelist':('whitelist.json',True),'unwhitelist':('whitelist.json',False),'ban':('banned-players.json',True),'pardon':('banned-players.json',False),'op':('ops.json',True),'deop':('ops.json',False)}[action]
            rows = self.read_players_file(sid,filename)
            rows = [r for r in rows if r['name'].lower()!=name.lower()]
            if add:
                if self.properties(sid).get('online-mode','true') == 'false':
                    digest=bytearray(hashlib.md5(('OfflinePlayer:'+name).encode()).digest());digest[6]=(digest[6]&15)|48;digest[8]=(digest[8]&63)|128
                    ident=str(uuid.UUID(bytes=bytes(digest)))
                else:
                    profile=self.providers.get('https://api.mojang.com/users/profiles/minecraft/'+name)
                    ident=str(uuid.UUID(profile['id']));name=profile['name']
                row={'name':name,'uuid':ident}
                if action=='op': row.update(level=4,bypassesPlayerLimit=False)
                if action=='ban': row.update(created=time.strftime('%Y-%m-%d %H:%M:%S +0000',time.gmtime()),source='MMSM',expires='forever',reason='Banned by an administrator')
                rows.append(row)
            atomic_write(confined(self.folder(sid),filename),json.dumps(rows,indent=2))
            return {'saved':True}

    def backup_settings(self, sid, data):
        with self.locks[sid]:
            s=self.active(sid)
            require(sid not in self.operation_guards, 'Wait for the current operation',409)
            rules=data.get('backup_rules',s.get('backup_rules',[])); schedules=data.get('schedules',s.get('schedules',[]))
            require(isinstance(rules,list) and len(rules)<=30 and isinstance(schedules,list) and len(schedules)<=50,'Too many rules or schedules')
            ids=set()
            for rule in rules:
                rule.setdefault('id',secrets.token_hex(12))
                require(re.fullmatch(r'[a-zA-Z0-9_-]{1,64}',rule['id']) and rule['id'] not in ids,'Invalid rule ID');ids.add(rule['id'])
                require(isinstance(rule.get('name'),str) and 1<=len(rule['name'])<=64,'Enter a rule name')
                require(type(rule.get('keep')) is int and 1<=rule['keep']<=1000,'Retention must be 1–1000 backups')
                require(isinstance(rule.get('path',''),str),'Invalid backup path')
                dest=Path(rule.get('path') or self.store.project_root/'Backups'/s.get('directory',sid))
                if not dest.is_absolute():dest=self.store.project_root/dest
                dest=dest.resolve()
                require(not dest.is_relative_to(self.store.servers_root.resolve()) and not dest.is_relative_to(self.folder(sid).resolve()),'Backups must be outside the Servers folder')
                rule['path']=str(dest)
            jobids=set()
            for job in schedules:
                job.setdefault('id',secrets.token_hex(12))
                require(re.fullmatch(r'[a-zA-Z0-9_-]{1,64}',job['id']) and job['id'] not in jobids,'Invalid schedule ID');jobids.add(job['id'])
                require(type(job.get('every')) is int and 1<=job['every']<=100000 and job.get('unit') in UNITS,'Choose a positive interval and unit')
                require(job.get('action') in ('backup','start','stop','restart','sleep'),'Invalid scheduled action')
                require(job['action']!='backup' or job.get('rule_id') in ids,'Choose an existing backup rule')
                require(type(job.get('enabled',True)) is bool,'Invalid schedule state')
                prior=next((j for j in s.get('schedules',[]) if j['id']==job['id']),{})
                unchanged=all(job.get(k)==prior.get(k) for k in ('every','unit','action','rule_id','enabled'))
                job['next_run']=prior.get('next_run',time.time()+job['every']*UNITS[job['unit']]) if unchanged else time.time()+job['every']*UNITS[job['unit']]
                for k in ('last_run','last_result'): 
                    if k in prior:job[k]=prior[k]
            s.update(backup_rules=rules,schedules=schedules);self.store.save_server(s)
            return self.public(s)

    def backup(self,sid,rule_id):
        with self.locks[sid]:
            s=self.active(sid)
            require(sid not in self.operation_guards,'A server operation is already in progress',409)
            require(self.state(sid)['status'] in ('running','starting','stopped','sleeping','error','crashed'),'Server is busy',409)
            rule=next((r for r in s.get('backup_rules',[]) if r['id']==rule_id),None)
            require(rule,'Backup rule not found',404)
            self.operation_guards.add(sid)
        was_running=self.alive(sid); was_sleeping=self.state(sid)['status']=='sleeping'
        backup_id=secrets.token_hex(12);path=None;tmp=None
        try:
            if was_running:self.stop(sid, internal=True)
            self.set_state(sid,status='backing_up')
            with self.locks[sid]:
                self.active(sid)
                dest=Path(rule['path'])
                require(not any(p.is_symlink() for p in [dest,*dest.parents]), 'Backup destination contains a symlink')
                dest.mkdir(parents=True,exist_ok=True)
                require(not dest.resolve().is_relative_to(self.store.servers_root.resolve()),'Backup path now points inside Servers')
                path=dest/f'mmsm-{sid}-{rule_id}-{backup_id}.zip';tmp=path.with_suffix('.part')
                root=self.folder(sid)
                with zipfile.ZipFile(tmp,'x',zipfile.ZIP_DEFLATED,allowZip64=True) as z:
                    for folder,dirs,files in os.walk(root,followlinks=False):
                        for name in dirs+files:require(not (Path(folder)/name).is_symlink(),'Remove symlinks before backing up')
                        for name in dirs:
                            directory=Path(folder)/name;z.write(directory,directory.relative_to(root).as_posix()+'/')
                        for name in files:
                            file=Path(folder)/name
                            require(file.is_file(), 'Backups support regular files only')
                            z.write(file,file.relative_to(root).as_posix())
                os.replace(tmp,path)
                self.store.execute('INSERT INTO backup_records VALUES(?,?,?,?,?)',(backup_id,sid,rule_id,str(path),time.time()))
                rows=self.store.rows('SELECT * FROM backup_records WHERE server_id=? AND rule_id=? ORDER BY created DESC',(sid,rule_id))
                for old in rows[rule['keep']:]:
                    target=Path(old['path'])
                    require(target.name==f'mmsm-{sid}-{rule_id}-{old["id"]}.zip','Invalid backup retention record')
                    require(not any(p.is_symlink() for p in target.parents),'Backup retention path contains a symlink')
                    target.unlink(missing_ok=True)
                    self.store.execute('DELETE FROM backup_records WHERE id=?',(old['id'],))
                return {'path':str(path),'id':backup_id}
        finally:
            if tmp:tmp.unlink(missing_ok=True)
            with self.locks[sid]:
                self.operation_guards.discard(sid)
                # A failed graceful stop must leave the live process intact.
                if not self.alive(sid):
                    self.set_state(sid,status='sleeping' if was_sleeping and not self.store.server(sid).get('manual_stop') else 'stopped',detail=None)
                    if was_running and not self.closing.is_set() and not self.store.server(sid).get('manual_stop') and not self.stop_requests[sid].is_set():self.start(sid, automatic=True)

    def queue_backup(self,sid,rule_id):
        self.active(sid)
        require(any(r['id']==rule_id for r in self.store.server(sid).get('backup_rules',[])),'Backup rule not found',404)
        def run():
            try:
                result=self.backup(sid,rule_id)
                with self.locks[sid]:
                    s=self.store.server(sid);s['backup_result']={'ok':True,**result};self.store.save_server(s)
            except Exception as e:
                with self.locks[sid]:
                    s=self.store.server(sid);s['backup_result']={'ok':False,'error':str(e)};self.store.save_server(s)
        self.spawn_job(run);return {'queued':True}

    def run_schedules(self,now=None):
        if self.updater.installing:return
        now=now or time.time()
        for candidate in self.store.servers(False):
            sid=candidate['id']
            if not self.locks[sid].acquire(blocking=False):continue
            try:
                s=self.active(sid)
                if sid in self.schedule_running or sid in self.operation_guards:continue
                job=next((j for j in s.get('schedules',[]) if j.get('enabled',True) and j['next_run']<=now),None)
                if not job:continue
                job['next_run']=now+job['every']*UNITS[job['unit']]
                self.store.save_server(s);self.schedule_running.add(sid)
                def run(server_id=sid, task=dict(job)):
                    outcome='Completed'
                    try:
                        with self.locks[server_id]:
                            current=self.active(server_id)
                            require(not (current.get('manual_stop') and task['action'] in ('start','restart','sleep')), 'Paused by manual Stop; use Start or Sleep now to resume',409)
                        if task['action']=='backup':self.backup(server_id,task['rule_id'])
                        elif task['action']=='stop':self.stop(server_id)
                        elif task['action']=='sleep':
                            with self.locks[server_id]:
                                token=secrets.token_hex(8);self.set_state(server_id,idle_token=token)
                            self.stop(server_id,sleeping=True,idle_token=token)
                        else:
                            with self.locks[server_id]:
                                require(not self.store.server(server_id).get('manual_stop'), 'Paused by manual Stop; use Start or Sleep now to resume',409)
                                getattr(self,task['action'])(server_id,automatic=True)
                            if task['action']=='restart':outcome='Restart queued'
                    except Exception as e:outcome='Failed: '+str(e)
                    finally:
                        with self.locks[server_id]:
                            latest=self.store.server(server_id)
                            for row in latest.get('schedules',[]):
                                if row['id']==task['id']:row.update(last_run=time.time(),last_result=outcome)
                            self.store.save_server(latest);self.schedule_running.discard(server_id)
                self.spawn_job(run)
            finally:self.locks[sid].release()

    def schedule_loop(self):
        while not self.closing.wait(1):
            try:self.run_schedules()
            except Exception as e:print('Scheduler:',e,flush=True)
