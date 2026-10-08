"""Offline integration tests. Provider fixtures never claim to be live upstream validation."""
import concurrent.futures
import contextlib
import hashlib
import io
import json
import os
from pathlib import Path
import socket
import struct
import tempfile
import threading
import time
import unittest
from unittest.mock import patch
import urllib.error
import urllib.request
import zipfile

from mmsm.store import Store, Problem, confined, password_matches
from mmsm.providers import Providers, safe_unzip, checked_url, FABRIC, FORGE, NEOFORGE, PAPER, MODRINTH
from mmsm.manager import Manager
from mmsm.web import WebServer
from mmsm.network import Proxy, packet, string, varint, read_packet, read_varint, Buffer, exact, status


def port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


def server(store, sid='testserver', sleep=False):
    s = dict(id=sid, name='Test world', loader='fabric', minecraft='1.20.1', loader_version='0.16.0',
             memory_mb=1024, port=port(), internal_port=port(), archived=False, sleep=sleep,
             idle_minutes=1, created=time.time(), mods=[], launch=None, eula=True)
    store.save_server(s)
    (store.root / 'servers' / sid / 'runtime').mkdir(parents=True)
    return s


def join_request(port):
    with socket.create_connection(('127.0.0.1',port),timeout=3) as client:
        client.sendall(packet(b'\0'+varint(767)+string('localhost')+struct.pack('>H',port)+b'\2'))
        buf=Buffer(read_packet(client));assert read_varint(buf)==0
        return json.loads(exact(buf,read_varint(buf)).decode())['text']


class Base(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = Store(self.temp.name)
        self.manager = Manager(self.store, start_background=False, proxy_host='127.0.0.1')

    def tearDown(self):
        self.manager.close()
        self.store.db.close()
        self.temp.cleanup()


class SecurityTests(Base):
    def test_owner_setup_is_atomic(self):
        def setup(i):
            try: return self.store.add_user('owner'+str(i), 'correct-horse-battery', 'owner', first=True)
            except Problem: return None
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            result = list(pool.map(setup, range(4)))
        self.assertEqual(sum(x is not None for x in result), 1)
        self.assertEqual(len(self.store.rows('SELECT * FROM users')), 1)

    def test_passwords_sessions_and_expiry(self):
        u = self.store.add_user('owner', 'correct-horse-battery', 'owner', first=True)
        stored = self.store.rows('SELECT password FROM users')[0]['password']
        self.assertNotIn('correct-horse', stored)
        self.assertTrue(password_matches('correct-horse-battery', stored))
        _, token, csrf = self.store.login('OWNER', 'correct-horse-battery')
        self.assertEqual(self.store.session(token)['id'], u['id'])
        self.assertEqual(self.store.session(token)['csrf'], csrf)
        self.store.execute('UPDATE sessions SET expires=0')
        with self.assertRaises(Problem): self.store.session(token)

    def test_traversal_and_symlink_rejected(self):
        root = self.store.root / 'servers'
        for path in ('../mmsm.sqlite3','/etc/passwd','a/../../passwd','a\\b'):
            with self.assertRaises(Problem): confined(root, path)
        (root/'link').symlink_to(self.store.root)
        with self.assertRaises(Problem): confined(root,'link/mmsm.sqlite3')

    def test_archive_path_traversal_and_symlink_rejected(self):
        archive = self.store.root/'bad.zip'
        with zipfile.ZipFile(archive,'w') as z: z.writestr('../escape','bad')
        with self.assertRaises(Problem): safe_unzip(archive,self.store.root/'out')
        with zipfile.ZipFile(archive,'w') as z:
            info = zipfile.ZipInfo('link'); info.external_attr=0o120777<<16; z.writestr(info,'/etc/passwd')
        with self.assertRaises(Problem): safe_unzip(archive,self.store.root/'out')

    def test_download_ssrf_rejected(self):
        for url in ('http://cdn.modrinth.com/foo','https://127.0.0.1/','https://cdn.modrinth.com.evil.test/a','https://user@cdn.modrinth.com/a','https://cdn.modrinth.com:444/a'):
            with self.assertRaises(Problem): checked_url(url)
        self.assertEqual(checked_url('https://cdn.modrinth.com/a'), 'https://cdn.modrinth.com/a')


class HTTPTests(Base):
    def setUp(self):
        super().setUp()
        self.web = WebServer(('127.0.0.1',0), self.manager)
        self.thread=threading.Thread(target=self.web.serve_forever,daemon=True); self.thread.start()
        self.base=f'http://127.0.0.1:{self.web.server_port}'
        self.token=self.csrf=None

    def tearDown(self):
        self.web.shutdown(); self.web.server_close(); self.thread.join()
        super().tearDown()

    def request(self,path,method='GET',data=None,headers=None):
        h={'Content-Type':'application/json'}
        if self.token:h['Cookie']=self.token
        if self.csrf:h['X-CSRF-Token']=self.csrf
        h.update(headers or {})
        req=urllib.request.Request(self.base+path,data=json.dumps(data).encode() if data is not None else None,method=method,headers=h)
        try:r=urllib.request.urlopen(req,timeout=4)
        except urllib.error.HTTPError as e:r=e
        raw=r.read()
        try:body=json.loads(raw)
        except json.JSONDecodeError:body=raw.decode()
        return r.status,body,r.headers

    def owner(self):
        self.assertEqual(self.request('/api/setup','POST',dict(username='owner',password='correct-horse-battery',token=self.web.setup_token))[0],201)
        code,body,headers=self.request('/api/login','POST',dict(username='owner',password='correct-horse-battery'))
        self.assertEqual(code,200)
        self.token=headers['Set-Cookie'].split(';')[0]; self.csrf=body['csrf']

    def test_setup_auth_csrf_roles_and_session_revocation(self):
        self.assertTrue(self.request('/api/setup')[1]['required'])
        self.assertEqual(self.request('/api/dashboard')[0],401)
        self.assertEqual(self.request('/api/setup','POST',dict(username='owner',password='correct-horse-battery',token='bad'))[0],403)
        self.owner()
        self.assertFalse(self.request('/api/setup')[1]['required'])
        self.assertEqual(self.request('/api/setup','POST',dict(username='second',password='correct-horse-battery',token=self.web.setup_token))[0],409)
        self.assertEqual(self.request('/api/settings','PUT',{'web_port':9001}, {'X-CSRF-Token':'bad'})[0],403)
        self.assertEqual(self.request('/api/dashboard',headers={'Origin':'https://evil.test'})[0],403)
        self.assertEqual(self.request('/api/dashboard',headers={'Host':'evil.test'})[0],403)
        code,viewer,_=self.request('/api/users','POST',dict(username='viewer',password='correct-horse-battery',role='viewer'))
        self.assertEqual(code,201)
        owner_cookie,owner_csrf=self.token,self.csrf
        _,login,h=self.request('/api/login','POST',dict(username='viewer',password='correct-horse-battery'))
        self.token=h['Set-Cookie'].split(';')[0];self.csrf=login['csrf']
        self.assertEqual(self.request('/api/dashboard')[0],200)
        self.assertEqual(self.request('/api/users')[0],403)
        self.assertEqual(self.request('/api/servers','POST',{})[0],403)
        viewer_cookie,viewer_csrf=self.token,self.csrf
        self.token,self.csrf=owner_cookie,owner_csrf
        self.assertEqual(self.request('/api/users/'+viewer['id'],'DELETE',{})[0],200)
        self.token,self.csrf=viewer_cookie,viewer_csrf
        self.assertEqual(self.request('/api/dashboard')[0],401)

    def test_settings_persist_and_static_security_headers(self):
        self.owner()
        code,body,_=self.request('/api/settings','PUT',{'web_port':9001,'default_memory_mb':2048})
        self.assertEqual(code,200);self.assertTrue(body['restart_required'])
        self.assertEqual(self.store.settings()['web_port'],9001)
        self.assertEqual(self.request('/api/settings','PUT',{'web_port':-1})[0],400)
        code,body,h=self.request('/')
        self.assertEqual(code,200);self.assertIn('MMSM',body)
        self.assertIn("frame-ancestors 'none'",h['Content-Security-Policy'])
        self.assertEqual(self.request('/../../etc/passwd')[0],404)

    def test_login_rate_limit(self):
        for _ in range(10):self.request('/api/login','POST',dict(username='missing',password='wrong'))
        self.assertEqual(self.request('/api/login','POST',dict(username='missing',password='wrong'))[0],429)

    def test_operator_cannot_install_or_modify_files(self):
        self.owner()
        self.request('/api/users','POST',dict(username='operator',password='correct-horse-battery',role='operator'))
        _,login,h=self.request('/api/login','POST',dict(username='operator',password='correct-horse-battery'))
        self.token=h['Set-Cookie'].split(';')[0];self.csrf=login['csrf']
        s=server(self.store)
        self.assertEqual(self.request('/api/servers/'+s['id']+'/mods-install','POST',{'version_id':'x'})[0],403)
        self.assertEqual(self.request('/api/servers/'+s['id']+'/files','PUT',{'path':'hello.txt','content':'a'})[0],403)
        self.assertEqual(self.request('/api/servers/'+s['id']+'/files')[0],200)


class LifecycleTests(Base):
    def test_archive_blocks_activity_and_excludes_totals(self):
        s=server(self.store)
        self.manager.latest={'host':{'cpu':50,'ram_used':1000},'servers':{s['id']:{'cpu':10,'ram':500,'players':5}}}
        self.assertEqual(self.manager.dashboard()['minecraft']['players'],5)
        self.manager.ensure_proxy(s)
        self.manager.archive(s['id'],True)
        self.assertEqual(self.manager.dashboard()['minecraft']['players'],0)
        self.assertNotIn(s['id'],self.manager.proxies)
        for operation in (lambda:self.manager.start(s['id']),lambda:self.manager.files(s['id'],''),lambda:self.manager.check_updates(s['id']),lambda:self.manager.mod_install(s['id'],'x'),lambda:self.manager.history(s['id'])):
            with self.assertRaises(Problem):operation()
        self.assertEqual(self.manager.archive(s['id'],False)['status'],'stopped')
        self.assertIn(s['id'],self.manager.proxies)

    def test_archive_excluded_from_historical_totals(self):
        s=server(self.store);now=time.time()
        self.store.execute('INSERT INTO metrics(server_id,ts,data) VALUES(?,?,?)',(s['id'],now,json.dumps({'cpu':10,'ram':500,'players':4,'rx_rate':30,'tx_rate':50})))
        self.store.execute('INSERT INTO metrics(server_id,ts,data) VALUES(NULL,?,?)',(now,json.dumps({'cpu':30,'ram_used':1000})))
        self.assertEqual(self.manager.history()[0]['players'],4)
        self.manager.archive(s['id'],True)
        self.assertEqual(self.manager.history()[0]['players'],0)
        self.assertEqual(len(self.store.rows('SELECT * FROM metrics WHERE server_id=?',(s['id'],))),1)

    def test_properties_round_trip_and_network_protection(self):
        s=server(self.store)
        self.manager.write_properties(s,{'motd':' Hello 🌍 \\u1234','max-players':'42'})
        p=self.manager.properties(s['id'])
        self.assertEqual(p['motd'],' Hello 🌍 \\u1234')
        self.assertEqual(p['server-port'],str(s['internal_port']))
        with self.assertRaises(Problem):self.manager.write_properties(s,{'server-ip':'0.0.0.0'})
        with self.assertRaises(Problem):self.manager.write_file(s['id'],'server.properties','oops')
        self.manager.write_file(s['id'],'config/test.json','{"value":1}')
        self.assertEqual(self.manager.files(s['id'],'config/test.json')['content'],'{"value":1}')

    def test_update_keeps_world_and_backup_and_failure_preserves_old(self):
        s=server(self.store);root=self.manager.folder(s['id'])
        (root/'world').mkdir();(root/'world'/'level.dat').write_bytes(b'world')
        (root/'server.jar').write_bytes(b'old')
        def installer(new,dest):
            (dest/'server.jar').write_bytes(b'new');return {'java':'java','java_major':17,'args':['-jar','server.jar','nogui']}
        with patch.object(self.manager.providers,'install_loader',side_effect=installer):
            self.manager.install(s['id'],'1.20.1','0.17.0')
        self.assertEqual((root/'world'/'level.dat').read_bytes(),b'world')
        self.assertEqual((root/'server.jar').read_bytes(),b'new')
        saved=self.store.server(s['id']);self.assertEqual(saved['loader_version'],'0.17.0')
        self.assertEqual((self.store.root/saved['last_backup']/'server.jar').read_bytes(),b'old')
        with patch.object(self.manager.providers,'install_loader',side_effect=Problem('upstream failed')):
            with self.assertRaises(Problem):self.manager.install(s['id'],'1.20.1','0.18.0')
        self.assertEqual((root/'server.jar').read_bytes(),b'new')
        self.assertEqual(self.store.server(s['id'])['loader_version'],'0.17.0')

    def test_download_checksum_and_interrupted_history(self):
        p=self.manager.providers;target=self.store.root/'downloads'/'test.jar'
        class Response(io.BytesIO): headers={'Content-Length':'4'}
        with patch.object(p,'open',side_effect=lambda _:Response(b'test')):
            p.download('https://cdn.modrinth.com/test.jar',target,{'sha256':hashlib.sha256(b'test').hexdigest()})
            self.assertEqual(target.read_bytes(),b'test')
            with self.assertRaises(Problem):p.download('https://cdn.modrinth.com/test.jar',target,{'sha256':'bad'})
        self.assertEqual(target.read_bytes(),b'test')
        history=[json.loads(r['data']) for r in self.store.rows('SELECT * FROM downloads')]
        self.assertEqual({d['status'] for d in history},{'completed','failed'})
        self.assertFalse(list(target.parent.glob('*.part')))
        p.save_download({'id':'interrupted','status':'downloading'})
        Providers(self.store)
        self.assertEqual(json.loads(self.store.rows('SELECT data FROM downloads WHERE id="interrupted"')[0]['data'])['status'],'interrupted')

    def test_mod_enable_disable_and_update_notifications_dedupe(self):
        s=server(self.store);root=self.manager.folder(s['id']);(root/'mods').mkdir();(root/'mods'/'demo.jar').write_bytes(b'jar')
        s['mods']=[dict(project_id='p',version_id='v1',path='mods/demo.jar',enabled=True,name='Demo',version='1',update=None,icon_url=None)]
        self.store.save_server(s)
        self.manager.toggle_mod(s['id'],'p',False)
        self.assertTrue((root/'mods'/'demo.jar.disabled').exists())
        self.manager.toggle_mod(s['id'],'p',True)
        self.assertTrue((root/'mods'/'demo.jar').exists())
        with patch.object(self.manager.providers,'mod_versions',return_value=[{'id':'v2','version_number':'2','date_published':'2026-01-02'}]),patch.object(self.manager.providers,'mod_version',return_value={'date_published':'2026-01-01'}):
            self.assertEqual(self.manager.check_updates(s['id'])['updates'],['Demo'])
            self.manager.check_updates(s['id'])
        self.assertEqual(len(self.store.rows('SELECT * FROM notifications')),1)

    def test_catalog_provider_contracts(self):
        p=self.manager.providers
        with patch.object(p,'get',side_effect=lambda url,**kwargs: [{'version':'1.20.1'}] if url.endswith('/game') else [{'loader':{'version':'0.16.0'}}]):
            self.assertEqual(p.catalog('fabric','1.20.1')['versions'],['0.16.0'])
        xml=b'<metadata><versioning><versions><version>1.20.1-47.3.0</version><version>1.21.1-52.0.0</version></versions></versioning></metadata>'
        with patch.object(p,'get',return_value=xml):
            self.assertEqual(p.catalog('forge','1.20.1')['versions'],['1.20.1-47.3.0'])
        with patch.object(p,'maven_versions',return_value=['21.1.10','21.0.1','20.2.1']):
            self.assertEqual(p.catalog('neoforge','1.21.1')['versions'],['21.1.10'])
        with patch.object(p,'get',side_effect=lambda url:{'versions':{'1.21':['1.21.1']}} if url==PAPER else [{'id':12,'channel':'STABLE'}]):
            self.assertEqual(p.catalog('paper','1.21.1')['versions'],['12'])

    def test_sleep_ignores_status_and_wakes_once_on_join(self):
        s=server(self.store,sleep=True);s['launch']={'java':'unused'};self.store.save_server(s)
        proxy=Proxy(self.manager,s['id'],s['port'],'127.0.0.1');self.manager.proxies[s['id']]=proxy
        calls=[]
        def start(sid, automatic=False):calls.append(sid);self.manager.set_state(sid,status='starting')
        with patch.object(self.manager,'start',side_effect=start):
            for _ in range(3):
                response=status(s['port']);self.assertEqual(response['players']['online'],0)
                self.assertIn('Join the server',response['description']['text'])
            self.assertEqual(calls,[])
            for _ in range(3):self.assertIn('try joining again',join_request(s['port']))
            deadline=time.time()+2
            while not calls and time.time()<deadline:time.sleep(.01)
        self.assertEqual(calls,[s['id']])

    def test_proxy_forwards_real_tcp_and_counts_traffic(self):
        s=server(self.store)
        backend=socket.socket();backend.bind(('127.0.0.1',s['internal_port']));backend.listen()
        def echo():
            conn,_=backend.accept()
            with conn: conn.sendall(conn.recv(100))
        thread=threading.Thread(target=echo,daemon=True);thread.start()
        self.manager.set_state(s['id'],status='running')
        self.manager.ensure_proxy(s)
        with socket.create_connection(('127.0.0.1',s['port'])) as client:
            client.sendall(b'hello minecraft');self.assertEqual(exact(client,15),b'hello minecraft')
        thread.join(2);backend.close()
        proxy=self.manager.proxies[s['id']]
        self.assertEqual(proxy.rx,15);self.assertEqual(proxy.tx,15)

    def test_failed_status_does_not_sleep(self):
        s=server(self.store,sleep=True)
        self.manager.set_state(s['id'],status='running',idle_since=time.time()-600)
        class Process:
            pid=os.getpid()
            def poll(self):return None
        self.manager.processes[s['id']]=Process()
        with patch('mmsm.manager.status',side_effect=OSError('offline')):
            self.manager.sample()
        self.assertIsNone(self.manager.state(s['id'])['idle_since'])
        self.assertIsNone(self.manager.latest['servers'][s['id']]['players'])
        self.manager.processes.clear()



class RealJVMTests(Base):
    def test_java_start_console_status_idle_sleep_and_wake(self):
        import shutil
        import subprocess
        java,javac=shutil.which('java'),shutil.which('javac')
        if not java:self.skipTest('Java not installed')
        compiler = [javac] if javac else [java, 'com.sun.tools.javac.Main']
        fixture=Path(__file__).parent/'fixtures'/'TestServer.java'
        classes=self.store.root/'classes';classes.mkdir()
        try:
            subprocess.run([*compiler,'-d',str(classes),str(fixture)],check=True,capture_output=True)
        except subprocess.CalledProcessError:
            self.skipTest('Java compiler module not installed')
        s=server(self.store,sleep=True)
        s['launch']={'java':java,'java_major':17,'args':['-cp',str(classes),'TestServer']}
        self.store.save_server(s)
        self.manager.start(s['id'])
        def wait_running():
            deadline=time.time()+8
            while time.time()<deadline:
                self.manager.sample()
                if self.manager.state(s['id'])['status']=='running':return
                time.sleep(.1)
            self.fail('JVM did not become ready: '+str(self.manager.state(s['id'])))
        wait_running()
        self.assertTrue(self.manager.alive(s['id']))
        self.manager.command(s['id'],'list')
        deadline=time.time()+2
        while not any('Command: list' in line for line in self.manager.logs[s['id']]) and time.time()<deadline:time.sleep(.01)
        self.assertTrue(any('Command: list' in line for line in self.manager.logs[s['id']]))
        self.manager.set_state(s['id'],idle_since=time.time()-120)
        self.manager.sample()
        deadline=time.time()+5
        while self.manager.state(s['id'])['status']!='sleeping' and time.time()<deadline:time.sleep(.02)
        self.assertEqual(self.manager.state(s['id'])['status'],'sleeping')
        self.assertFalse(self.manager.alive(s['id']))
        self.assertTrue((self.manager.folder(s['id'])/'world-saved.txt').exists())
        response=status(s['port'])
        self.assertIn('Join the server',response['description']['text'])
        self.assertEqual(self.manager.state(s['id'])['status'],'sleeping')
        self.assertIn('try joining again',join_request(s['port']))
        wait_running()
        self.manager.stop(s['id'])
        self.assertFalse(self.manager.alive(s['id']))

class JavaProviderTests(Base):
    def test_minecraft_metadata_drives_java_major(self):
        s=server(self.store);s['loader']='vanilla';s['loader_version']='1.20.1';p=self.manager.providers
        def download(url,dest,*args,**kwargs):Path(dest).write_bytes(b'jar')
        manifest={'javaVersion':{'majorVersion':25},'downloads':{'server':{'url':'https://piston-data.mojang.com/server.jar','sha1':'test-sha1'}}}
        with patch.object(p,'catalog',return_value={'versions':['1.20.1']}),patch.object(p,'manifest',return_value=manifest),patch.object(p,'java',return_value='/managed/java25') as java,patch.object(p,'download',side_effect=download):
            launch=p.install_loader(s,self.manager.folder(s['id']))
            java.assert_called_once_with(25)
            self.assertEqual(launch['java_major'],25)
            self.assertEqual(launch['args'],['-jar','server.jar','nogui'])

    def test_forge_installer_uses_argument_file(self):
        import subprocess
        s=server(self.store);s['loader']='forge';s['loader_version']='1.20.1-47.3.0';p=self.manager.providers
        root=self.manager.folder(s['id'])
        def installer(*args,**kwargs):
            argfile=root/'libraries'/'forge'/('win_args.txt' if os.name=='nt' else 'unix_args.txt')
            argfile.parent.mkdir(parents=True);argfile.write_text('fixture args')
            return subprocess.CompletedProcess([],0)
        with patch.object(p,'catalog',return_value={'versions':[s['loader_version']]}),patch.object(p,'manifest',return_value={'javaVersion':{'majorVersion':17}}),patch.object(p,'java',return_value='java'),patch.object(p,'download'),patch('mmsm.providers.subprocess.run',side_effect=installer):
            launch=p.install_loader(s,root)
        self.assertTrue(launch['args'][0].startswith('@libraries'))
        self.assertEqual(launch['args'][-1],'nogui')

    def test_failed_installer_log_is_preserved(self):
        s=server(self.store)
        def failure(new,stage):
            (stage/'installer.log').write_text('specific loader failure')
            raise Problem('Installer failed')
        with patch.object(self.manager.providers,'install_loader',side_effect=failure):
            with self.assertRaises(Problem):self.manager.install(s['id'],s['minecraft'],s['loader_version'])
        self.assertEqual((self.manager.folder(s['id'])/'installer.log').read_text(),'specific loader failure')
