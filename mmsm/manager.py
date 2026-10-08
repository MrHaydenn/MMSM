import collections
import contextlib
import copy
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import socket
import subprocess
import threading
import time
import zipfile

from .store import Problem, require, confined, atomic_write
from .providers import Providers, MODRINTH, safe_unzip
from .network import Proxy, status
from .metrics import Sampler

LOADERS = ('vanilla', 'fabric', 'forge', 'neoforge', 'paper')
PROTECTED_PROPERTIES = {'server-port', 'server-ip', 'enable-query', 'enable-rcon', 'enable-status'}


from .features import Features


class Manager(Features):
    def __init__(self, store, start_background=True, proxy_host='0.0.0.0'):
        self.store, self.providers = store, Providers(store)
        self.proxy_host = proxy_host
        self.lock = threading.RLock()
        self.stop_requests = collections.defaultdict(threading.Event)
        self.locks = collections.defaultdict(threading.RLock)
        self.processes, self.proxies, self.states, self.logs = {}, {}, {}, {}
        self.closing = threading.Event()
        self.sampler = Sampler()
        self.latest = {'host': {}, 'servers': {}}
        self.background = start_background
        self.jobs = set()
        from .updater import Updater
        self.updater = Updater(self)
        from .unm_tunnel import UNMTunnel
        self.store.set_settings({'unm_tunnel_enabled': False})
        self.unm_tunnel = UNMTunnel(self)
        self.initialize_features()
        from .syncs import Syncs
        self.syncs = Syncs(self)
        if start_background:
            for s in store.servers(False):
                try:
                    self.ensure_proxy(s)
                except OSError as e:
                    self.set_state(s['id'], status='error', error='Public port unavailable: ' + str(e))
            from .domains import loop as dns_loop
            threading.Thread(target=dns_loop, args=(self,), daemon=True).start()
            threading.Thread(target=self.syncs.loop, daemon=True).start()
            threading.Thread(target=self.monitor, daemon=True).start()
            threading.Thread(target=self.update_loop, daemon=True).start()
            threading.Thread(target=self.schedule_loop, daemon=True).start()

    def folder(self, sid):
        s = self.store.server(sid)
        if s.get('directory'):
            return confined(self.store.servers_root, s['directory'])
        return self.store.root / 'servers' / sid / 'runtime'

    def state(self, sid):
        s = self.store.server(sid)
        if s['archived']:
            return {'status': 'archived'}
        default = 'crashed' if s.get('crash_active') else self.dormant_status(s)
        return {'status': default, **self.states.get(sid, {})}

    def set_state(self, sid, **kwargs):
        self.states.setdefault(sid, {}).update(kwargs)

    def active(self, sid):
        s = self.store.server(sid)
        require(not s['archived'], 'Archived servers are dormant. Unarchive this server first.', 409)
        return s

    def idle(self, sid):
        require(not self.updater.installing, 'MMSM update in progress',409)
        s = self.active(sid)
        require(sid not in self.operation_guards, 'A backup or restart is in progress', 409)
        require(not self.alive(sid), 'Stop the server before changing its files or configuration', 409)
        require(self.state(sid)['status'] not in ('installing', 'updating', 'stopping', 'killing', 'backing_up', 'restarting'), 'A server operation is already in progress', 409)
        return s

    def alive(self, sid):
        proc = self.processes.get(sid)
        return proc is not None and proc.poll() is None

    def public(self, s):
        from .domains import plan
        address = plan(self.store.settings(), s) if s.get('public_address', {}).get('label') else {}
        return {**s, **self.state(s['id']), 'port_shared': sum(x['port'] == s['port'] for x in self.store.servers()) > 1, 'public_hostname': address.get('hostname'), 'metrics': self.latest['servers'].get(s['id'], {}), 'icon': (self.folder(s['id']) / 'server-icon.png').is_file()}

    def ensure_proxy(self, server, claim=False):
        with self.lock:
            for other_id, proxy in list(self.proxies.items()):
                if other_id == server['id']: continue
                other = self.store.server(other_id)
                if other['port'] != server['port']: continue
                if not claim: return
                require(not self.alive(other_id) and self.state(other_id)['status'] not in
                        ('starting', 'stopping', 'killing', 'restarting') and
                        not (other.get('sleep') and not other.get('manual_stop')),
                        'Public port is held by another running or sleeping server. Stop it first.', 409)
                proxy.close(); del self.proxies[other_id]
            if server['id'] not in self.proxies:
                self.proxies[server['id']] = Proxy(self, server['id'], server['port'], self.proxy_host)
            if claim:
                self.set_state(server['id'], status='starting')

    def spawn_job(self, fn):
        def run():
            try:
                fn()
            finally:
                with self.lock:
                    self.jobs.discard(threading.current_thread())
        thread = threading.Thread(target=run, daemon=True)
        with self.lock:
            self.jobs.add(thread)
        thread.start()

    def job(self, sid, label, fn):
        with self.locks[sid]:
            self.idle(sid)
            self.set_state(sid, status=label, error=None)
        def run():
            with self.locks[sid]:
                try:
                    fn()
                    s = self.store.server(sid)
                    self.set_state(sid, status=self.dormant_status(s), error=None)
                except Exception as e:
                    self.set_state(sid, status='error', error=str(e))
                    if label not in ('installing', 'updating'):
                        self.store.notify(sid, f'{label.capitalize()} failed: {e}')
        self.spawn_job(run)
        return {'queued': True}

    def create(self, data):
        defaults = self.store.settings()
        source_id = data.get('source_id')
        source = None
        if source_id:
            source = self.idle(source_id)
            require(not source.get('sync'), 'Choose a source that does not follow another server')
            require(data.get('source_mode', 'copy') in ('copy', 'sync'), 'Choose copy or sync')
            data = {**data, 'loader': source['loader'], 'minecraft': source['minecraft'], 'loader_version': source['loader_version'], 'memory_mb': source['memory_mb'], 'sleep': source['sleep']}
        name = str(data.get('name', '')).strip()
        require(1 <= len(name) <= 64, 'Server name must be 1–64 characters')
        loader = data.get('loader', defaults['default_loader'])
        require(loader in LOADERS, 'Unsupported loader')
        memory = int(data.get('memory_mb', defaults['default_memory_mb']))
        require(512 <= memory <= 262144, 'Memory must be between 0.5 and 256 GB')
        mc = str(data.get('minecraft', ''))
        lv = mc if loader == 'vanilla' else str(data.get('loader_version', ''))
        require(re.fullmatch(r'[a-zA-Z0-9_.+\-]{1,100}', mc) and re.fullmatch(r'[a-zA-Z0-9_.+\-]{1,100}', lv), 'Select Minecraft and loader versions')
        require(defaults['auto_eula'], 'Enable automatic EULA acceptance in Settings after reviewing the Minecraft EULA')
        port = int(data['port']) if data.get('port') not in (None, '') else None
        require(port is None or 1024 <= port <= 65535, 'Public port must be 1024–65535')
        with self.lock:
            reserved = {p for s in self.store.servers() for p in (s['port'], s['internal_port'])}
            reserved.add(self.store.settings()['web_port'])
            if port is None:
                for candidate in range(defaults.get('default_port_min',25565), defaults.get('default_port_max',25665)+1):
                    if candidate in reserved: continue
                    with socket.socket() as test:
                        try: test.bind(('0.0.0.0', candidate))
                        except OSError: continue
                    port = candidate; break
                require(port is not None, 'No unused port is available in the default range', 409)
            conflicts = [s for s in self.store.servers() if s['port'] == port]
            require(port != defaults['web_port'] and all(s['internal_port'] != port for s in self.store.servers()), 'Port is reserved for MMSM or an internal server connection', 409)
            require(not conflicts or data.get('allow_port_conflict') is True,
                    'PORT_CONFLICT: Port is already assigned. Create anyway? Only one server can use this port at a time.', 409)
            internal = None
            for candidate in range(30000, 60000):
                if candidate in reserved or candidate == port:
                    continue
                with socket.socket() as test:
                    try:
                        test.bind(('127.0.0.1', candidate))
                        internal = candidate
                        break
                    except OSError:
                        pass
            require(internal, 'No internal server port available', 409)
            sid = secrets.token_hex(12)
            server = dict(id=sid, name=name, loader=loader, minecraft=mc, loader_version=lv,
                          memory_mb=memory, port=port, internal_port=internal, archived=False, created_by=data.get('created_by'),
                          sleep=bool(data.get('sleep', defaults['default_sleep'])),
                          idle_minutes=source['idle_minutes'] if source else defaults['idle_minutes'], created=time.time(), mods=[], launch=None,
                          eula=True, directory=self.directory_name(name, sid))
            from .domains import validate_address
            server['public_address'] = validate_address(self, {'label':data.get('address_label',''), 'port':data.get('external_port') or port}, sid, port)
            self.store.save_server(server)
            try:
                self.folder(sid).mkdir(parents=True)
                if self.background:
                    self.ensure_proxy(server)
            except Exception:
                shutil.rmtree(self.folder(sid), ignore_errors=True)
                self.store.execute('DELETE FROM servers WHERE id=?', (sid,))
                raise
        from .domains import publish
        publish(self, sid)
        server = self.store.server(sid)
        def provision():
            if not source_id:
                return self.install(sid, mc, lv)
            import copy
            with self.locks[source_id]:
                template = self.idle(source_id)
                self.install(sid, mc, lv)
                require(template['minecraft'] == mc and template['loader_version'] == lv, 'Source runtime changed; recreate the server from its current settings')
                folders = [name for name in ('config','mods','plugins','defaultconfigs') if (self.folder(source_id)/name).is_dir()]
                require(self.properties(source_id).get('level-name','world') not in folders, 'World folders cannot be copied as configuration')
                self.syncs.digest(self.folder(source_id), folders)
                for folder in folders:
                    shutil.copytree(self.folder(source_id)/folder, self.folder(sid)/folder, dirs_exist_ok=True)
                target = self.store.server(sid)
                target['mods'] = copy.deepcopy(template.get('mods', []))
                self.store.save_server(target)
                self.write_properties(target, {k:v for k,v in self.properties(source_id).items() if k not in PROTECTED_PROPERTIES})
                if data.get('source_mode') == 'sync':
                    target = self.store.server(sid)
                    target['sync'] = dict(source_id=source_id, folders=folders, runtime=True, settings=True, status='Pending first sync')
                    self.store.save_server(target)
        self.job(sid, 'installing', provision)
        return self.public(server)

    def write_properties(self, server, values=None, root=None):
        root = root or self.folder(server['id'])
        p = root / 'server.properties'
        props = self.properties(server['id'], root) if p.exists() else {'motd': server['name'], 'max-players': '20', 'online-mode': 'true', 'difficulty': 'normal', 'gamemode': 'survival'}
        if values:
            for key, value in values.items():
                require(key not in PROTECTED_PROPERTIES, f'{key} is managed by MMSM')
                require(re.fullmatch(r'[a-zA-Z0-9_.-]+', key), 'Invalid property name')
                require(isinstance(value, (str, int, bool)), 'Invalid property value')
                value = str(value).lower() if isinstance(value, bool) else str(value)
                require('\n' not in value and '\r' not in value and len(value) <= 4096, 'Invalid property value')
                props[key] = value
        props.update({'server-port': str(server['internal_port']), 'server-ip': '127.0.0.1', 'enable-query': 'false', 'enable-rcon': 'false', 'enable-status': 'true'})
        # Properties escaping preserves Unicode and literal backslashes across edits.
        def escape(value):
            out = ''
            for i, c in enumerate(value):
                if c == '\\': out += '\\\\'
                elif c in '\n\r\t': out += {'\n': '\\n', '\r': '\\r', '\t': '\\t'}[c]
                elif i == 0 and c == ' ': out += '\\ '
                elif ord(c) > 127:
                    raw = c.encode('utf-16-be')
                    out += ''.join('\\u' + raw[j:j+2].hex() for j in range(0, len(raw), 2))
                else: out += c
            return out
        atomic_write(p, '# Managed by MMSM\n' + '\n'.join(k + '=' + escape(v) for k, v in props.items()) + '\n')
        atomic_write(root / 'eula.txt', 'eula=true\n')

    def properties(self, sid, root=None):
        self.active(sid)
        p = (root or self.folder(sid)) / 'server.properties'
        if not p.exists():
            return {}
        result, continuation = {}, ''
        for raw in p.read_text(encoding='utf-8', errors='replace').splitlines():
            line = continuation + raw.lstrip()
            if len(line) - len(line.rstrip('\\')) & 1:
                continuation = line[:-1]
                continue
            continuation = ''
            if not line or line.startswith(('#', '!')):
                continue
            match = re.match(r'([^:=\s]+)\s*[:=]?\s*(.*)', line)
            if match:
                k, v = match.groups()
                def unescape(m):
                    token = m.group(1)
                    if token.startswith('u') and len(token) == 5:
                        return chr(int(token[1:], 16))
                    return {'n': '\n', 'r': '\r', 't': '\t'}.get(token, token)
                v = re.sub(r'\\(u[0-9a-fA-F]{4}|.)', unescape, v)
                v = v.encode('utf-16', 'surrogatepass').decode('utf-16')
                result[k] = v
        return result

    def install(self, sid, mc, lv):
        server = self.active(sid)
        base = self.store.root / 'servers' / sid
        base.mkdir(parents=True, exist_ok=True)
        stage = base / ('stage-' + secrets.token_hex(5))
        stage.mkdir()
        old = self.folder(sid)
        new = {**server, 'minecraft': mc, 'loader_version': lv}
        try:
            launch = self.providers.install_loader(new, stage)
            # Keep worlds/config/mods, but replace only the managed runtime artifacts.
            runtime_names = {'libraries', 'versions', 'server.jar', 'installer.jar', 'installer.log',
                             'run.sh', 'run.bat', 'user_jvm_args.txt', '.fabric', 'fabric-server-launcher.properties'}
            if old.exists():
                for p in old.iterdir():
                    if p.name in runtime_names or re.match(r'(forge|neoforge|minecraft_server)[-\.].*\.jar$', p.name):
                        continue
                    require(not p.is_symlink(), 'Remove server-folder symlinks before updating')
                    target = stage / p.name
                    if target.exists():
                        continue
                    if p.is_dir():
                        shutil.copytree(p, target, symlinks=True)
                    else:
                        shutil.copy2(p, target)
            self.write_properties(new, root=stage)
            backup = self.store.root / 'backups' / sid / (str(time.time_ns()) + '-runtime')
            backup.parent.mkdir(parents=True, exist_ok=True)
            os.replace(old, backup)
            try:
                os.replace(stage, old)
                new.update(launch=launch, last_backup=str(backup.relative_to(self.store.root)))
                self.store.save_server(new)
            except Exception:
                if old.exists(): shutil.rmtree(old)
                os.replace(backup, old)
                raise
            self.providers.mark_installed(sid,stage,old)
            self.store.execute("UPDATE notifications SET resolved=1 WHERE server_id=? AND kind='runtime'", (sid,))
        except Exception:
            # Keep the installer diagnostic even though the failed staging tree is removed.
            if (stage / 'installer.log').is_file():
                atomic_write(old / 'installer.log', (stage / 'installer.log').read_bytes())
            raise
        finally:
            shutil.rmtree(stage, ignore_errors=True)

    def update_server(self, sid, data):
        with self.locks[sid]:
            s = self.idle(sid)
            mc, lv = str(data.get('minecraft', s['minecraft'])), str(data.get('loader_version', s['loader_version']))
            require(re.fullmatch(r'[a-zA-Z0-9_.+\-]{1,100}', mc) and re.fullmatch(r'[a-zA-Z0-9_.+\-]{1,100}', lv), 'Invalid version')
            return self.job(sid, 'updating', lambda: self.install(sid, mc, lv))

    def start(self, sid, automatic=False):
        require(not self.closing.is_set(), 'Manager is shutting down', 409)
        with self.locks[sid]:
            s = self.idle(sid)
            if automatic: require(not self.stop_requests[sid].is_set(), 'Start cancelled by Stop',409)
            else: self.stop_requests[sid].clear()
            require(s.get('launch'), 'Install the server successfully before starting', 409)
            self.ensure_proxy(s, claim=True)
            self.write_properties(s)
            launch = s['launch']
            args = [launch['java'], '-Xms512M', f'-Xmx{s["memory_mb"]}M', *launch['args']]
            self.set_state(sid, status='starting', error=None, detail=None, started=time.time(), idle_since=None, players=None, idle_token=None)
            self.logs[sid] = collections.deque(maxlen=2000)
            try:
                require(Path(launch['java']).is_file(), 'Java runtime is missing; reinstall/update this server')
                proc = subprocess.Popen(args, cwd=self.folder(sid), stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                        stderr=subprocess.STDOUT, text=True, encoding='utf-8', errors='replace', bufsize=1,
                                        start_new_session=os.name != 'nt')
            except Exception as e:
                self.record_crash(sid, str(e))
                raise
            s['manual_stop'] = False
            s['crash_active'] = False
            self.store.save_server(s)
            self.processes[sid] = proc
            self.logs[sid] = collections.deque(maxlen=2000)
            self.online_names[sid] = set()
            threading.Thread(target=self.read_log, args=(sid, proc), daemon=True).start()
        return {'started': True}

    def read_log(self, sid, proc):
        try:
            for line in proc.stdout:
                self.logs[sid].append(line.rstrip()[:10000])
                try: self.player_log(sid, line[:10000])
                except Exception as e: print('Player log parsing:', e, flush=True)
        finally:
            proc.stdout.close()
            if proc.stdin:
                proc.stdin.close()
            code = proc.wait()
            with self.locks[sid]:
                if self.processes.get(sid) is proc and self.store.rows('SELECT 1 FROM servers WHERE id=?',(sid,)):
                    state = self.state(sid)
                    if state['status'] in ('running', 'starting'):
                        self.record_crash(sid, f'Server exited unexpectedly with code {code}', code)

    def record_crash(self, sid, message, code=None):
        self.set_state(sid, status='crashed', error=message, exit_code=code, players=0)
        s = self.store.server(sid)
        s['crash_active'] = True
        s['last_crash'] = {'time': time.time(), 'error': message, 'exit_code': code}
        s['manual_stop'] = True  # Never let a server-list ping restart a crashed process.
        self.store.save_server(s)
        atomic_write(self.store.root / 'crashes' / (sid + '.txt'), self.error_report(sid, saved=False))

    def error_report(self, sid, saved=True):
        s = self.active(sid)
        report = self.store.root / 'crashes' / (sid + '.txt')
        if saved and report.is_file() and self.state(sid)['status'] == 'crashed':
            return report.read_text(encoding='utf-8')
        header = f"MMSM server: {s['name']}\nMinecraft: {s['minecraft']} | Loader: {s['loader']} {s['loader_version']}\nJava: {s.get('launch')}\nState: {self.state(sid)}\n\nConsole (last 2000 lines):\n"
        return header + '\n'.join(self.logs.get(sid, []))

    def start_configured_servers(self):
        for s in self.store.servers():
            if s.get('autostart') and not s['archived'] and s.get('launch'):
                self.stop_requests[s['id']].clear()
                def boot(server_id=s['id']):
                    try:
                        with self.locks[server_id]:
                            if self.stop_requests[server_id].is_set() or self.store.server(server_id)['archived']: return
                            self.start(server_id, automatic=True)
                    except Exception as e:
                        with self.locks[server_id]:
                            if not self.stop_requests[server_id].is_set(): self.record_crash(server_id, str(e))
                self.spawn_job(boot)

    def command(self, sid, command):
        if isinstance(command, str) and command.strip() == 'stop':
            return self.stop(sid)
        with self.locks[sid]:
            self.active(sid)
            require(self.alive(sid), 'Server is not running', 409)
            require(isinstance(command, str) and 0 < len(command) <= 4096 and '\n' not in command and '\r' not in command, 'Invalid console command')
            proc = self.processes[sid]
            proc.stdin.write(command + '\n')
            proc.stdin.flush()
        return {'sent': True}

    def stop(self, sid, sleeping=False, internal=False, idle_token=None):
        # Record intent before waiting for a backup's file lock.
        if not internal and not sleeping: self.stop_requests[sid].set()
        with self.locks[sid]:
            s = self.active(sid)
            if idle_token is not None and (self.stop_requests[sid].is_set() or s.get('manual_stop') or self.state(sid).get('idle_token') != idle_token):
                return {'cancelled': True}
            if not internal and not sleeping and sid in self.operation_guards:
                s['manual_stop'] = True
                self.store.save_server(s)
                self.set_state(sid, detail='Stop requested; finishing the current operation without restarting.', idle_token=None)
                return {'stop_requested': True}
            require(internal or sid not in self.operation_guards, 'A backup or restart is in progress', 409)
            require(self.state(sid)['status'] not in ('installing', 'updating', 'killing', 'backing_up'), 'Wait for the operation to finish', 409)
            if sleeping:
                if idle_token is None: self.stop_requests[sid].clear()
                require(s['sleep'], 'Enable and save sleep settings first', 409)
                require(s.get('launch'), 'Install the server before putting it to sleep', 409)
                self.ensure_proxy(s, claim=True)
            if not internal:
                s['manual_stop'] = not sleeping
                s['crash_active'] = False
                self.store.save_server(s)
            proc = self.processes.get(sid)
            token = secrets.token_hex(8)
            self.set_state(sid, status='stopping', stop_token=token, idle_token=None, detail=None)
            if proc and proc.poll() is None:
                with contextlib.suppress(OSError, ValueError):
                    proc.stdin.write('stop\n'); proc.stdin.flush()
        # Waiting outside the operation lock lets an explicit Kill interrupt a stuck stop.
        if proc and proc.poll() is None:
            try:
                proc.wait(timeout=45)
            except subprocess.TimeoutExpired:
                with self.locks[sid]:
                    if self.processes.get(sid) is proc and proc.poll() is None and self.state(sid).get('stop_token') == token:
                        self.set_state(sid, status='running', stop_token=None, error='Graceful stop timed out. Check the console or use Kill process.')
                        raise Problem('Server did not stop within 45 seconds. Use Kill process only if you want to force termination.', 409)
        with self.locks[sid]:
            if self.processes.get(sid) is proc and self.state(sid).get('stop_token') == token:
                self.set_state(sid, status='sleeping' if sleeping else 'stopped', stop_token=None,
                               players=0, idle_since=None, error=None)
        return {'stopped': True, 'sleeping': self.state(sid)['status'] == 'sleeping'}

    def sleep_now(self, sid):
        return self.stop(sid, sleeping=True)

    def kill(self, sid):
        with self.locks[sid]:
            self.active(sid)
            require(self.state(sid)['status'] not in ('installing', 'updating'), 'Wait for the operation to finish', 409)
            proc = self.processes.get(sid)
            require(proc and proc.poll() is None, 'Server process is not running', 409)
            s = self.store.server(sid); s['manual_stop'] = True; self.store.save_server(s)
            self.set_state(sid, status='killing', stop_token=None)
            try:
                proc.kill()
            except OSError:
                if proc.poll() is None:
                    self.set_state(sid, status='running', error='Could not terminate the server process')
                    raise
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            self.set_state(sid, status='error', error='The operating system has not released the killed process')
            raise Problem('The server process has not exited yet', 409)
        with self.locks[sid]:
            if self.processes.get(sid) is proc:
                self.set_state(sid, status='stopped', players=0, idle_since=None, stop_token=None,
                               exit_code=proc.returncode, error=None)
        self.store.notify(sid, 'Server process was force-killed. Unsaved world changes may have been lost.')
        return {'killed': True}

    def wake(self, sid):
        # Ping bursts must not queue dozens of starts behind an installation lock.
        lock = self.locks[sid]
        if not lock.acquire(blocking=False):
            return
        try:
            s = self.active(sid)
            if not s['sleep'] or s.get('manual_stop') or sid in self.operation_guards or self.alive(sid) or self.state(sid)['status'] not in ('sleeping', 'stopped'):
                return
            self.set_state(sid, status='waking')
        finally:
            lock.release()
        def wake_job():
            try:
                with self.locks[sid]:
                    if self.store.server(sid).get('manual_stop') or self.state(sid)['status'] != 'waking': return
                    self.start(sid, automatic=True)
            except Exception as e:
                if self.state(sid)['status'] != 'crashed': self.set_state(sid, status='error', error=str(e))
        self.spawn_job(wake_job)

    def archive(self, sid, archived):
        with self.locks[sid]:
            s = self.store.server(sid)
            if archived:
                require(sid not in self.operation_guards and sid not in self.schedule_running, 'Wait for the current operation', 409)
                require(not self.alive(sid), 'Stop this server before archiving', 409)
                require(self.state(sid)['status'] not in ('installing', 'updating', 'waking', 'backing_up', 'restarting', 'stopping', 'killing'), 'Wait for the server operation to finish', 409)
                proxy = self.proxies.pop(sid, None)
                if proxy: proxy.close()
                s['archived'] = True
                self.store.save_server(s)
                self.latest['servers'].pop(sid, None)
                self.states.pop(sid, None)
            else:
                require(s['archived'], 'Server is not archived', 409)
                self.ensure_proxy(s)  # If port is occupied, leave it archived.
                s['archived'] = False
                self.store.save_server(s)
        return self.public(s)

    def configure(self, sid, data):
        with self.locks[sid]:
            s = self.idle(sid)
            for key in ('name', 'sleep', 'autostart', 'idle_minutes', 'memory_mb'):
                if key in data: s[key] = data[key]
            require(isinstance(s['name'], str) and 1 <= len(s['name'].strip()) <= 64, 'Invalid name')
            require(isinstance(s['sleep'], bool), 'Sleep must be true or false')
            require(isinstance(s.get('autostart', False), bool), 'AutoStart must be true or false')
            require(isinstance(s['idle_minutes'], int) and 1 <= s['idle_minutes'] <= 1440, 'Idle interval must be 1–1440 minutes')
            require(isinstance(s['memory_mb'], int) and 512 <= s['memory_mb'] <= 262144, 'Memory must be 0.5–256 GB')
            self.rename_directory(s)
            self.store.save_server(s)
            self.set_state(sid, status='crashed' if s.get('crash_active') else self.dormant_status(s))
            return self.public(s)

    def mod_install(self, sid, version_id):
        require(self.active(sid)['loader']!='vanilla','Vanilla cannot install mods. Use Fabric, NeoForge, or Forge for mods, or Paper for plugins.',409)
        return self.job(sid, 'installing', lambda: self.install_mods(sid, version_id))

    def install_mods(self, sid, version_id):
        s = self.active(sid)
        require(s['loader'] != 'vanilla', 'Vanilla does not support mods or plugins')
        resolved, visiting = {}, set()
        def resolve(vid):
            if vid in visiting: return
            visiting.add(vid)
            v = self.providers.mod_version(vid)
            require(s['minecraft'] in v['game_versions'] and set(self.providers.compatible_loaders(s['loader'])).intersection(v['loaders']), 'Mod version is incompatible with this server')
            project = self.providers.get(MODRINTH + '/project/' + v['project_id'])
            require(project.get('server_side') != 'unsupported', 'This is a client-only project')
            require(project['project_type'] in ('mod', 'plugin'), 'Use the modpack installer for modpacks')
            require(v['project_id'] not in resolved or resolved[v['project_id']]['id'] == v['id'], 'Dependency versions conflict')
            resolved[v['project_id']] = {**v, 'project_name': project['title'], 'icon_url': project.get('icon_url')}
            for dependency in v.get('dependencies', []):
                if dependency['dependency_type'] == 'required':
                    if dependency.get('version_id'):
                        resolve(dependency['version_id'])
                    elif dependency.get('project_id'):
                        versions = self.providers.mod_versions(dependency['project_id'], s)
                        require(versions, 'Required dependency has no compatible server version')
                        resolve(versions[0]['id'])
                elif dependency['dependency_type'] == 'incompatible':
                    require(not any(m['project_id'] == dependency.get('project_id') and m['enabled'] for m in s['mods']), 'An installed mod conflicts with this version')
        resolve(version_id)
        installed_ids = {m['project_id']: m['version_id'] for m in s['mods'] if m['enabled'] and m.get('source')!='local'}
        installed_ids.update({pid: v['id'] for pid, v in resolved.items()})
        for v in resolved.values():
            for dep in v.get('dependencies', []):
                if dep['dependency_type'] == 'incompatible':
                    require(not (dep.get('project_id') in installed_ids or dep.get('version_id') in installed_ids.values()),
                            'Resolved dependency conflicts with an installed or selected mod')
        root = self.folder(sid)
        stage = root.parent / ('mods-' + secrets.token_hex(5))
        stage.mkdir()
        try:
            planned = []
            for pid, v in resolved.items():
                artifact = next((f for f in v['files'] if f.get('primary')), v['files'][0])
                filename = artifact['filename']
                require(filename == Path(filename).name and filename.endswith('.jar'), 'Expected a jar artifact')
                require(artifact.get('hashes'), 'Mod artifact has no checksum')
                self.providers.download(artifact['url'], confined(stage, filename), artifact['hashes'], sid)
                folder = 'plugins' if s['loader'] == 'paper' else 'mods'
                old = next((m for m in s['mods'] if m['project_id'] == pid), None)
                enabled = old['enabled'] if old and pid == next(iter(resolved)) else True
                planned.append(dict(project_id=pid, version_id=v['id'], name=v['project_name'],
                                    version=v['version_number'], icon_url=v.get('icon_url'), path=folder + '/' + filename,
                                    enabled=enabled, update=None, hashes=artifact['hashes'], source='modrinth',
                                    requires_project_ids=self.required_projects(v, resolved)))
            require(len({m['path'] for m in planned}) == len(planned), 'Two projects use the same filename')
            unchanged = [m for m in s['mods'] if m['project_id'] not in resolved]
            require(not ({m['path'] for m in planned} & {m['path'] for m in unchanged}), 'Mod filename conflicts with another installed project')
            backup = self.store.root / 'backups' / sid / (str(time.time_ns()) + '-mods')
            backup.mkdir(parents=True)
            affected = {m['path'] + ('' if m['enabled'] else '.disabled') for m in s['mods'] if m['project_id'] in resolved}
            affected |= {m['path'] + ('' if m['enabled'] else '.disabled') for m in planned}
            originals = {}
            for name in affected:
                p = confined(root, name)
                originals[name] = p.exists()
                if p.exists():
                    target = confined(backup, name); target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(p, target)
            try:
                for name in affected: confined(root, name).unlink(missing_ok=True)
                for m in planned:
                    dest = confined(root, m['path'] + ('' if m['enabled'] else '.disabled'))
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    os.replace(stage / Path(m['path']).name, dest)
                s['mods'] = unchanged + planned
                self.store.save_server(s)
            except Exception:
                for name, existed in originals.items():
                    p = confined(root, name)
                    if existed:
                        shutil.copy2(confined(backup, name), p)
                    else:
                        p.unlink(missing_ok=True)
                raise
            for m in planned:
                self.providers.mark_installed(sid,stage/Path(m['path']).name,root/(m['path']+('' if m['enabled'] else '.disabled')))
        finally:
            shutil.rmtree(stage, ignore_errors=True)

    def required_projects(self, version, resolved=None):
        result=set()
        for dep in version.get('dependencies', []):
            if dep.get('dependency_type')!='required':continue
            pid=dep.get('project_id')
            if not pid and dep.get('version_id'):
                match=next((v for v in (resolved or {}).values() if v['id']==dep['version_id']),None)
                pid=(match or self.providers.mod_version(dep['version_id'])).get('project_id')
            if pid:result.add(pid)
        return sorted(result)

    def upload_mod(self, sid, filename, stream, length):
        with self.locks[sid]:
            s=self.idle(sid)
            require(s['loader']!='vanilla','Vanilla cannot install mods. Use Fabric, NeoForge, or Forge for mods, or Paper for plugins.',409)
            require(isinstance(filename,str) and filename and '/' not in filename and '\\' not in filename and filename.lower().endswith('.jar'),'Choose a .jar filename without folders')
            filename=filename[:-4]+'.jar'
            folder='plugins' if s['loader']=='paper' else 'mods'
            path=folder+'/'+filename
            dest=self.mutable_file(sid,path)
            directory=confined(self.folder(sid),folder);directory.mkdir(exist_ok=True)
            names={p.name.casefold() for p in directory.iterdir()}
            require(filename.casefold() not in names and (filename+'.disabled').casefold() not in names and not any(m['path'].casefold()==path.casefold() for m in s['mods']),'A project with this filename already exists',409)
            self.upload_file(sid,path,stream,length)
            try:
                require(zipfile.is_zipfile(dest),'This file is not a valid JAR/ZIP archive')
                entry=dict(project_id='local-'+secrets.token_hex(12),version_id=None,name=Path(filename).stem,
                           version='Local file',path=path,enabled=True,source='local',icon_url=None,update=None)
                s['mods'].append(entry)
                self.store.save_server(s)
            except Exception:
                dest.unlink(missing_ok=True)
                raise
            return {'uploaded':True,'mod':entry}

    def toggle_mod(self, sid, pid, enabled):
        with self.locks[sid]:
            s = self.idle(sid)
            require(isinstance(enabled, bool), 'Enabled must be true or false')
            m = next((m for m in s['mods'] if m['project_id'] == pid), None)
            require(m, 'Installed project not found', 404)
            if m['enabled'] != enabled:
                source = confined(self.folder(sid), m['path'] + ('' if m['enabled'] else '.disabled'))
                target = confined(self.folder(sid), m['path'] + ('' if enabled else '.disabled'))
                require(source.is_file(), 'Installed artifact is missing')
                require(not target.exists(), 'Target artifact already exists', 409)
                os.replace(source, target)
                previous=m['enabled']
                m['enabled'] = enabled
                try:self.store.save_server(s)
                except Exception:
                    os.replace(target,source);m['enabled']=previous;raise
            return m

    def install_pack(self, sid, vid):
        require(self.active(sid)["loader"]!="vanilla","Vanilla cannot install modpacks. Use Fabric, NeoForge, or Forge.",409)
        return self.job(sid, 'installing', lambda: self.pack(sid, vid))

    def pack(self, sid, vid):
        s = self.active(sid)
        require(not s['mods'] and not s.get('modpack') and not (self.folder(sid) / 'world').exists(), 'Install modpacks only on a fresh server without a world or installed mods')
        version = self.providers.mod_version(vid)
        artifacts = [f for f in version['files'] if f['filename'].endswith('.mrpack')]
        require(artifacts, 'Version has no .mrpack file')
        artifact = next((f for f in artifacts if f.get('primary')), artifacts[0])
        package = self.providers.download(artifact['url'], self.store.root / 'downloads' / (secrets.token_hex(8) + '.mrpack'), artifact['hashes'], sid)
        stage = self.folder(sid).parent / ('pack-' + secrets.token_hex(5))
        stage.mkdir()
        try:
            with zipfile.ZipFile(package) as z:
                require(z.getinfo('modrinth.index.json').file_size <= 16 * 1024**2, 'Modpack manifest too large')
                index = json.loads(z.read('modrinth.index.json'))
            require(index.get('formatVersion') == 1 and index.get('game') == 'minecraft', 'Unsupported modpack format')
            deps = index['dependencies']
            require(deps.get('minecraft') == s['minecraft'], 'Create a server using the modpack Minecraft version first')
            loader_key = {'fabric': 'fabric-loader', 'forge': 'forge', 'neoforge': 'neoforge'}.get(s['loader'])
            require(loader_key and loader_key in deps, 'Modpack requires a different server loader')
            expected = deps[loader_key]
            if s['loader'] == 'forge' and not expected.startswith(s['minecraft'] + '-'):
                expected = s['minecraft'] + '-' + expected
            require(s['loader_version'] == expected, f'Modpack requires loader version {expected}')
            shutil.copytree(self.folder(sid), stage, dirs_exist_ok=True, symlinks=True)
            require(len(index['files']) <= 5000, 'Modpack has too many files')
            for f in index['files']:
                if f.get('env', {}).get('server') == 'unsupported': continue
                path = f['path']
                # Pack content must not replace our runtime, scripts, properties or Java arguments.
                require(Path(path).parts and Path(path).parts[0] in ('mods', 'config', 'defaultconfigs', 'kubejs', 'scripts', 'resourcepacks', 'datapacks'), 'Unsupported modpack file path: ' + path)
                require(f.get('hashes'), 'Modpack file is missing checksums')
                require(f.get('downloads'), 'Modpack file has no download URL')
                last_error = None
                for url in f['downloads']:
                    try:
                        self.providers.download(url, confined(stage, path), f['hashes'], sid)
                        last_error = None
                        break
                    except Exception as e:
                        last_error = e
                if last_error: raise last_error
            overrides = stage.parent / ('overrides-' + secrets.token_hex(5))
            overrides.mkdir()
            try:
                safe_unzip(package, overrides, 'overrides/')
                safe_unzip(package, overrides, 'server-overrides/')
                for p in overrides.iterdir():
                    require(p.name in ('mods', 'config', 'defaultconfigs', 'kubejs', 'scripts', 'resourcepacks', 'datapacks', 'options.txt'), 'Unsafe or unsupported override: ' + p.name)
                    if p.is_dir(): shutil.copytree(p, stage / p.name, dirs_exist_ok=True)
                    else: shutil.copy2(p, stage / p.name)
            finally:
                shutil.rmtree(overrides, ignore_errors=True)
            # Identify jar hashes through Modrinth so packed mods also support updates/toggles.
            mods, untracked = [], []
            for jar in (stage / 'mods').glob('*.jar') if (stage / 'mods').exists() else []:
                import hashlib
                digest = hashlib.sha512(jar.read_bytes()).hexdigest()
                try:
                    v = self.providers.get(MODRINTH + '/version_file/' + digest + '?algorithm=sha512')
                    mods.append(dict(project_id=v['project_id'], version_id=v['id'], name=jar.stem,
                                     version=v['version_number'], path='mods/' + jar.name, enabled=True, update=None,
                                     hashes={'sha512': digest}))
                except Problem:
                    untracked.append('mods/' + jar.name)
            self.write_properties(s, root=stage)
            backup = self.store.root / 'backups' / sid / (str(time.time_ns()) + '-prepack')
            backup.parent.mkdir(parents=True, exist_ok=True)
            old = self.folder(sid)
            os.replace(old, backup)
            try:
                os.replace(stage, old)
                s.update(mods=mods, modpack={'project_id': version['project_id'], 'version_id': vid, 'name': index['name'], 'untracked_files': untracked}, last_backup=str(backup.relative_to(self.store.root)))
                self.store.save_server(s)
            except Exception:
                if old.exists(): shutil.rmtree(old)
                os.replace(backup, old)
                raise
            # Installation status belongs in Downloads and server details.
        finally:
            shutil.rmtree(stage, ignore_errors=True)

    def mod_icons(self, sid):
        with self.locks[sid]:
            s = self.active(sid)
            require(self.state(sid)['status'] not in ('installing', 'updating'), 'Wait for installation to finish', 409)
            for m in s['mods']:
                if m.get('source')=='local' or 'icon_url' in m:
                    continue
                project = self.providers.get(MODRINTH + '/project/' + m['project_id'])
                m['icon_url'] = project.get('icon_url')
                m['name'] = project.get('title', m['name'])
            self.store.save_server(s)
            return {'mods': s['mods']}

    def check_updates(self, sid):
        with self.locks[sid]:
            s = self.active(sid)
            require(self.state(sid)['status'] not in ('installing', 'updating'), 'Wait for installation to finish', 409)
            found = []
            for m in s['mods']:
                if m.get('source')=='local':continue
                if 'icon_url' not in m:
                    try:
                        project = self.providers.get(MODRINTH + '/project/' + m['project_id'])
                        m['icon_url'] = project.get('icon_url')
                    except Problem:
                        pass
                versions = self.providers.mod_versions(m['project_id'], s)
                versions = [v for v in versions if s['minecraft'] in v.get('game_versions', [s['minecraft']])
                            and set(self.providers.compatible_loaders(s['loader'])).intersection(v.get('loaders', [s['loader']]))]
                latest = max(versions, key=lambda v: v['date_published']) if versions else None
                # Never call a different, older release an update.
                current = self.providers.mod_version(m['version_id'])
                m['requires_project_ids']=self.required_projects(current)
                m['source']='modrinth'
                if latest and latest['id'] != m['version_id'] and latest['date_published'] > current['date_published']:
                    m['update'] = {'id': latest['id'], 'name': latest['version_number']}
                    found.append(m['name'])
                    self.store.notify(sid, f'{s["name"]}: {m["name"]} {latest["version_number"]} is available', f'{sid}:{m["project_id"]}:{latest["id"]}', kind='mod', payload={'tab':'mods'})
                else:
                    m['update'] = None
            s['last_update_check'] = time.time()
            self.store.save_server(s)
            return {'updates': found}

    def check_due_updates(self):
        if self.updater.installing:return
        self.updater.due()
        interval = self.store.settings()['update_interval_hours'] * 3600
        for candidate in self.store.servers(False):
            if self.closing.is_set(): return
            sid = candidate['id']
            lock = self.locks[sid]
            if not lock.acquire(blocking=False): continue
            try:
                for fn, stamp, retry in ((self.check_updates, 'last_update_check', 'next_update_retry'),
                                         (self.check_runtime_updates, 'last_runtime_check', 'runtime_retry')):
                    s = self.store.server(sid)
                    if s['archived'] or sid in self.operation_guards: break
                    if stamp == 'last_runtime_check' and not s.get('launch'): continue
                    now = time.time()
                    if now - s.get(stamp, 0) < interval or s.get(retry, 0) > now: continue
                    try:
                        fn(sid)
                        latest = self.store.server(sid)
                        latest[stamp] = time.time()
                        latest.pop(retry, None)
                    except Exception as e:
                        latest = self.store.server(sid)
                        if latest['archived']: break
                        latest[retry] = time.time() + min(900, interval)
                        print('Update check failed for', s['name'], str(e), flush=True)
                    self.store.save_server(latest)
            finally:
                lock.release()

    def update_loop(self):
        while not self.closing.wait(60):
            self.check_due_updates()

    def mutable_file(self, sid, path):
        root = self.folder(sid)
        p = confined(root, path)
        parts = Path(path).parts
        require(parts and p != root, 'Choose a file')
        require(not any(':' in part or part.endswith((' ', '.')) for part in parts), 'Invalid filename')
        protected = {'server.properties', 'eula.txt', 'server.jar', 'installer.jar', 'installer.log',
                     'run.sh', 'run.bat', 'user_jvm_args.txt', 'unix_args.txt', 'win_args.txt',
                     'fabric-server-launcher.properties'}
        require(p.name.lower() not in protected and parts[0].lower() not in ('libraries', 'versions', '.fabric')
                and not (len(parts) == 1 and re.match(r'(forge|neoforge|minecraft_server)[-\.].*\.jar$', p.name, re.I)),
                'This file is managed by MMSM. Use Properties or Update runtime instead.', 409)
        return p

    def upload_file(self, sid, path, stream, length):
        require(type(length) is int and 0 <= length <= 512 * 1024**2, 'Upload limit is 512 MB per file', 413)
        with self.locks[sid]:
            self.idle(sid)
            dest = self.mutable_file(sid, path)
            require(dest.parent.is_dir(), 'Upload destination folder does not exist', 404)
            require(not dest.exists(), 'A file with that name already exists. Rename your upload or delete the old file first.', 409)
            staging = self.folder(sid).parent / ('upload-' + secrets.token_hex(12) + '.part')
            try:
                remaining = length
                with staging.open('xb') as output:
                    while remaining:
                        chunk = stream.read(min(remaining, 128 * 1024))
                        require(chunk, 'Upload was interrupted before all bytes arrived')
                        output.write(chunk)
                        remaining -= len(chunk)
                # Recheck confinement and collisions immediately before the commit.
                dest = self.mutable_file(sid, path)
                require(not dest.exists(), 'Destination already exists', 409)
                os.replace(staging, dest)
            finally:
                staging.unlink(missing_ok=True)
            return {'uploaded': True, 'path': path, 'bytes': length}

    def delete_file(self, sid, path, directory=False):
        with self.locks[sid]:
            s = self.idle(sid)
            p = self.mutable_file(sid, path)
            require(isinstance(directory, bool), 'Invalid folder deletion flag')
            require(p.is_dir() if directory else p.is_file(), 'Choose an existing folder' if directory else 'Choose an existing file', 404)
            path = p.relative_to(self.folder(sid)).as_posix()
            if directory:
                for child in p.rglob('*'):
                    self.mutable_file(sid, child.relative_to(self.folder(sid)).as_posix())
            def removed(value):
                return value == path or (directory and value.startswith(path + '/'))
            backup = self.store.root / 'backups' / sid / (str(time.time_ns()) + '-deleted-files')
            target = confined(backup, path)
            target.parent.mkdir(parents=True, exist_ok=True)
            os.replace(p, target)
            try:
                s['mods'] = [m for m in s['mods'] if not removed(m['path'] + ('' if m['enabled'] else '.disabled'))]
                if s.get('modpack'):
                    s['modpack']['untracked_files'] = [x for x in s['modpack'].get('untracked_files', []) if not removed(x)]
                self.store.save_server(s)
            except Exception:
                os.replace(target, p)
                raise
            return {'deleted': True, 'backup': str(target.relative_to(self.store.root))}

    def files(self, sid, path):
        self.active(sid)
        p = confined(self.folder(sid), path)
        require(p.exists(), 'Path not found', 404)
        if p.is_dir():
            return {'path': path, 'entries': [{'name': x.name, 'directory': x.is_dir(), 'symlink': x.is_symlink(),
                      'size': x.lstat().st_size} for x in sorted(p.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower()))][:5000]}
        require(p.stat().st_size <= 2 * 1024**2, 'File is too large for the text viewer (2 MiB limit)')
        try: content = p.read_text('utf-8')
        except UnicodeDecodeError: raise Problem('This is a binary file; only UTF-8 text can be viewed')
        return {'path': path, 'content': content}

    def write_file(self, sid, path, content):
        with self.locks[sid]:
            self.idle(sid)
            require(isinstance(content, str) and len(content.encode()) <= 2 * 1024**2, 'Text file too large')
            p = confined(self.folder(sid), path)
            require(p.suffix in ('.txt', '.json', '.toml', '.yml', '.yaml', '.cfg', '.conf', '.properties'), 'Only configuration/text files can be edited')
            require(p.name not in ('server.properties', 'eula.txt', 'user_jvm_args.txt', 'unix_args.txt', 'win_args.txt') and not set(Path(path).parts) & {'libraries', 'versions'}, 'Use the Properties editor, or update the managed runtime')
            atomic_write(p, content)
            return {'saved': True}

    def monitor(self):
        while not self.closing.is_set():
            try: self.sample()
            except Exception as e: print('Metric sample failed:', e, flush=True)
            self.closing.wait(5)

    def sample(self):
        host = self.sampler.host()
        dt = host.pop('dt')
        timestamp = time.time()
        servers = {}
        for s in self.store.servers(False):
            sid = s['id']
            cpu, ram, players = 0, 0, 0
            if self.alive(sid):
                cpu, ram = self.sampler.process(self.processes[sid].pid, dt)
                try:
                    report = status(s['internal_port'])
                    players = report['players']['online']
                    if self.state(sid)['status'] == 'starting':
                        self.set_state(sid, status='running', idle_since=timestamp)
                    self.set_state(sid, players=players)
                    state = self.state(sid)
                    if players:
                        self.set_state(sid, idle_since=None)
                    elif state.get('idle_since') is None:
                        self.set_state(sid, idle_since=timestamp)
                    elif s['sleep'] and not s.get('manual_stop') and timestamp - state['idle_since'] >= s['idle_minutes'] * 60 and state['status'] == 'running':
                        idle_token = secrets.token_hex(8)
                        self.set_state(sid, status='stopping', idle_token=idle_token)
                        def sleep_job(server_id=sid, token=idle_token):
                            try: self.stop(server_id, sleeping=True, idle_token=token)
                            except Exception as e: self.store.notify(server_id, 'Sleep failed: ' + str(e))
                        self.spawn_job(sleep_job)
                except (OSError, ValueError, EOFError, KeyError):
                    players = None  # Unknown is not zero; never sleep on a failed status query.
                    self.set_state(sid, idle_since=None, players=None)
            proxy = self.proxies.get(sid)
            totals = (proxy.rx, proxy.tx) if proxy else (0, 0)
            prior = self.sampler.previous.get(sid, totals)
            self.sampler.previous[sid] = totals
            metric = dict(cpu=cpu, ram=ram, players=players, rx_rate=max(0, totals[0] - prior[0]) / dt,
                          tx_rate=max(0, totals[1] - prior[1]) / dt, rx_bytes=totals[0], tx_bytes=totals[1])
            # Recheck after network I/O: archive may have occurred during polling.
            with self.locks[sid]:
                if not self.store.rows('SELECT 1 FROM servers WHERE id=?',(sid,)) or self.store.server(sid)['archived']: continue
                servers[sid] = metric
                self.record_usage(sid, timestamp, dt, metric, totals, prior)
                self.store.execute('INSERT INTO metrics(server_id,ts,data) VALUES(?,?,?)', (sid, timestamp, json.dumps(metric)))
        self.latest = {'host': host, 'servers': servers, 'ts': timestamp}
        self.store.execute('INSERT INTO metrics(server_id,ts,data) VALUES(NULL,?,?)', (timestamp, json.dumps(host)))
        self.store.execute('DELETE FROM metrics WHERE ts<?', (timestamp - self.store.settings()['retention_days'] * 86400,))
        self.store.execute('DELETE FROM sessions WHERE expires<?', (timestamp,))
        self.store.execute('DELETE FROM usage_hourly WHERE bucket<?',(timestamp-366*86400,))
        if timestamp-getattr(self,'last_download_prune',0)>3600:
            self.store.prune_downloads();self.last_download_prune=timestamp

    def dashboard(self, allowed=None):
        active = [s for s in self.store.servers(False) if allowed is None or s["id"] in allowed]
        metrics = [self.latest['servers'].get(s['id'], {}) for s in active]
        host = self.latest['host']
        mc_cpu = sum(m.get('cpu') or 0 for m in metrics)
        mc_ram = sum(m.get('ram') or 0 for m in metrics)
        return {'host': host, 'minecraft': {'cpu': mc_cpu, 'ram': mc_ram,
                'players': sum(m.get('players') or 0 for m in metrics),
                'unknown_players': sum(m.get('players') is None for m in metrics),
                'rx_rate': sum(m.get('rx_rate') or 0 for m in metrics), 'tx_rate': sum(m.get('tx_rate') or 0 for m in metrics)},
                'other': {'cpu': max(0, host['cpu'] - mc_cpu) if host.get('cpu') is not None else None,
                          'ram': max(0, host['ram_used'] - mc_ram) if host.get('ram_used') is not None else None},
                'servers': [self.public(s) for s in active], 'ts': self.latest.get('ts')}

    def history(self, sid=None, hours=24, allowed=None):
        require(1 <= hours <= 720, 'History window must be 1–720 hours')
        if sid: self.active(sid)
        since = time.time() - hours * 3600
        # Aggregate in SQLite before decoding to bound response size at ~240 points per series.
        bucket = max(5, hours * 3600 // 240)
        if sid:
            rows = self.store.rows('SELECT CAST(ts / ? AS INTEGER) * ? AS ts, AVG(json_extract(data,\'$.cpu\')) AS cpu, AVG(json_extract(data,\'$.ram\')) AS ram, AVG(json_extract(data,\'$.players\')) AS players, AVG(json_extract(data,\'$.rx_rate\')) AS rx_rate, AVG(json_extract(data,\'$.tx_rate\')) AS tx_rate FROM metrics WHERE server_id=? AND ts>=? GROUP BY CAST(ts / ? AS INTEGER) ORDER BY ts', (bucket, bucket, sid, since, bucket))
            return rows
        active = [s['id'] for s in self.store.servers(False) if allowed is None or s['id'] in allowed]
        hostrows = self.store.rows('SELECT CAST(ts / ? AS INTEGER) * ? AS ts, AVG(json_extract(data,\'$.cpu\')) AS host_cpu, AVG(json_extract(data,\'$.ram_used\')) AS host_ram FROM metrics WHERE server_id IS NULL AND ts>=? GROUP BY CAST(ts / ? AS INTEGER) ORDER BY ts', (bucket, bucket, since, bucket))
        result = {r['ts']: {**r, 'cpu': 0, 'ram': 0, 'players': 0, 'rx_rate': 0, 'tx_rate': 0} for r in hostrows}
        for server_id in active:
            for row in self.history(server_id, hours):
                target = result.setdefault(row['ts'], {'ts': row['ts'], 'cpu': 0, 'ram': 0, 'players': 0, 'rx_rate': 0, 'tx_rate': 0})
                for k in ('cpu', 'ram', 'players', 'rx_rate', 'tx_rate'):
                    target[k] += row[k] or 0
        return sorted(result.values(), key=lambda r: r['ts'])

    def close(self):
        self.closing.set()
        self.unm_tunnel.close()
        # Wait for a folder transaction before shutting down its store/listeners.
        with self.syncs.lock:
            pass
        failures = []
        for s in self.store.servers(False):
            if self.alive(s['id']):
                try: self.stop(s['id'], internal=True)
                except Exception as e: failures.append(str(e))
        for proxy in list(self.proxies.values()): proxy.close()
        # Let transactional download/install work settle before exiting.
        for job in list(self.jobs): job.join(timeout=60)
        return failures
