import hashlib, io, json, tempfile, unittest, zipfile
from pathlib import Path
from unittest.mock import patch
import test_manager as support
from mmsm import __version__
from mmsm.manager import Manager
from mmsm.store import Store, Problem, atomic_write
from mmsm.updater import apply, recover, validate_url, public_url
from mmsm.themes import THEMES, css

class Updates(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.project=Path(self.temp.name)/'project';self.project.mkdir()
        self.store=Store(self.project/'data',project_root=self.project);self.manager=Manager(self.store,start_background=False);self.u=self.manager.updater
        self.store.set_settings({'update_feed':'https://example.com/latest.json'})
        self.files={name:b'# fixture\n' for name in ['mmsm/__main__.py','mmsm/store.py','mmsm/manager.py','mmsm/web.py','mmsm/updater.py']}
        self.files.update({'mmsm/__init__.py':b"__version__='99.0.0'\n",'mmsm/static/app.js':b'// fixture','mmsm/static/index.html':b'fixture','mmsm/static/style.css':b'/* fixture */'})
    def tearDown(self):
        self.manager.close();self.store.db.close();self.temp.cleanup()
    def release(self,extras=None):
        raw=io.BytesIO()
        with zipfile.ZipFile(raw,'w') as z:
            for name,content in {**self.files,**(extras or {})}.items():z.writestr(name,content)
        content=raw.getvalue()
        return {'version':'99.0.0','url':'https://example.com/update.zip','sha256':hashlib.sha256(content).hexdigest()},content
    def test_checks_and_notifications_and_interval(self):
        m,_=self.release()
        with patch('mmsm.updater.fetch',return_value=json.dumps(m).encode()) as fetch:
            self.assertEqual(self.u.check()['status'],'available');self.u.check()
            self.assertEqual(len(self.store.rows("SELECT * FROM notifications WHERE kind='wrapper'")),1)
            fetch.reset_mock();self.u.due();fetch.assert_not_called()
            self.store.set_settings({'wrapper_update_checks':False});self.u.last_check=0;self.u.due();fetch.assert_not_called()
    def test_current_failure_and_unconfigured(self):
        m,_=self.release();m['version']=__version__
        with patch('mmsm.updater.fetch',return_value=json.dumps(m).encode()):self.assertEqual(self.u.check()['status'],'current')
        with patch('mmsm.updater.fetch',return_value=b'bad'):self.assertEqual(self.u.check()['status'],'failed');self.assertIsNone(self.u.manifest)
        self.store.set_settings({'update_feed':''});self.assertEqual(self.u.check()['status'],'unconfigured')
    def test_reject_checksum_paths_incomplete_version_mismatch(self):
        m,r=self.release()
        with self.assertRaises(Problem):self.u.stage(dict(m,sha256='0'*64),r)
        for path in ('../escape.py','data/world.py','mmsm/data/world.py','mmsm/../../outside.py'):
            m,r=self.release({path:b'bad'})
            with self.assertRaises(Problem):self.u.stage(m,r)
        m,r=self.release({'mmsm/__init__.py':b"__version__='98.0.0'"})
        with self.assertRaises(Problem):self.u.stage(m,r)
        del self.files['mmsm/web.py'];m,r=self.release()
        with self.assertRaises(Problem):self.u.stage(m,r)
    def test_apply_preserves_worlds_data_and_keeps_program_backup(self):
        atomic_write(self.project/'mmsm/web.py',b'# old');atomic_write(self.project/'Servers/world/level.dat',b'world');atomic_write(self.store.root/'keep.txt',b'settings')
        m,r=self.release();self.u.stage(m,r);apply(self.project,self.u.work)
        self.assertEqual((self.project/'mmsm/web.py').read_bytes(),self.files['mmsm/web.py'])
        self.assertEqual((self.project/'Servers/world/level.dat').read_bytes(),b'world');self.assertEqual((self.store.root/'keep.txt').read_bytes(),b'settings')
        self.assertEqual((self.u.work/'rollback/mmsm/web.py').read_bytes(),b'# old');self.assertFalse((self.u.work/'transaction.json').exists())
    def test_replace_failure_rolls_back(self):
        atomic_write(self.project/'mmsm/web.py',b'# old');m,r=self.release();self.u.stage(m,r);failed=[]
        def write(path,data):
            if Path(path)==self.project/'mmsm/web.py' and not failed:failed.append(True);raise PermissionError('fixture lock')
            return atomic_write(path,data)
        with patch('mmsm.updater.atomic_write',side_effect=write):
            with self.assertRaises(PermissionError):apply(self.project,self.u.work)
        self.assertEqual((self.project/'mmsm/web.py').read_bytes(),b'# old');self.assertFalse((self.project/'mmsm/__main__.py').exists())
    def test_interrupted_transaction_recovery(self):
        atomic_write(self.u.work/'rollback/mmsm/web.py',b'old');atomic_write(self.project/'mmsm/web.py',b'partial')
        atomic_write(self.u.work/'transaction.json',json.dumps([{'path':'mmsm/web.py','existed':True}]))
        recover(self.project,self.u.work);self.assertEqual((self.project/'mmsm/web.py').read_bytes(),b'old')
    def test_install_busy_gate_and_preparation(self):
        m,r=self.release();self.u.shutdown=lambda:None
        with patch('mmsm.updater.fetch',side_effect=lambda url,limit:json.dumps(m).encode() if url.endswith('json') else r):
            self.manager.jobs.add('busy')
            try:
                with self.assertRaises(Problem):self.u.prepare()
            finally:self.manager.jobs.clear()
            self.assertFalse(self.u.installing);self.assertTrue(self.u.prepare()['restarting']);self.assertTrue(self.u.pending)
            s=support.server(self.store)
            with self.assertRaises(Problem):self.manager.idle(s['id'])
    def test_reject_private_hosts(self):
        for url in ('http://example.com/x','https://127.0.0.1/x','https://localhost/x','https://user:pass@example.com/x'):
            with self.assertRaises(Problem):validate_url(url)
        with patch('mmsm.updater.socket.getaddrinfo',return_value=[(None,None,None,None,('192.168.1.1',443))]):
            with self.assertRaises(Problem):public_url('https://example.com/x')
    def test_complete_theme_palettes(self):
        self.assertEqual(len(THEMES),5)
        for name in THEMES:
            for key in ('accent','bg','panel','panel2','navbar','hover','line','text','muted'):self.assertIn('--'+key+':',css(name))

class HTTPChanges(support.HTTPTests):
    test_setup_auth_csrf_roles_and_session_revocation=None
    test_settings_persist_and_static_security_headers=None
    test_login_rate_limit=None
    test_operator_cannot_install_or_modify_files=None
    def test_vanilla_creation_and_install_routes(self):
        self.owner()
        with patch.object(self.manager,'job',return_value={'queued':True}):code,body,_=self.request('/api/servers','POST',{'name':'Vanilla','loader':'vanilla','minecraft':'1.21.1','port':support.port()})
        self.assertEqual(code,201);sid=body['id'];self.assertEqual(self.store.server(sid)['loader_version'],'1.21.1')
        for action,body in [('mods-install',{'version_id':'x'}),('project-install',{'project_id':'p','type':'mod'})]:
            code,result,_=self.request('/api/servers/'+sid+'/'+action,'POST',body);self.assertEqual(code,409);self.assertIn('Fabric',str(result))
        with self.assertRaises(Problem):self.manager.install_pack(sid,'x')
    def test_settings_and_update_permissions(self):
        self.owner()
        self.assertEqual(self.request('/api/settings','PUT',{'theme':'amethyst','update_feed':'https://example.com/latest.json','wrapper_update_checks':False})[0],200)
        self.assertIn('--navbar:#1b1426',self.request('/theme.css')[1])
        self.assertEqual(self.request('/api/settings','PUT',{'theme':'invalid'})[0],400)
        self.assertEqual(self.request('/api/settings','PUT',{'update_feed':'http://localhost/x'})[0],400)
        with patch.object(self.manager.updater,'check',return_value={'status':'current'}):self.assertEqual(self.request('/api/wrapper-update/check','POST',{})[0],200)
        self.assertEqual(self.request('/api/wrapper-update/install','POST',{})[0],409)
        self.request('/api/users','POST',dict(username='viewer',password='correct-horse-battery',role='viewer'))
        _,body,h=self.request('/api/login','POST',dict(username='viewer',password='correct-horse-battery'));self.token=h['Set-Cookie'].split(';')[0];self.csrf=body['csrf']
        self.assertEqual(self.request('/api/wrapper-update/check','POST',{})[0],403);self.assertEqual(self.request('/api/wrapper-update/install','POST',{})[0],403)

class RestartIntegration(unittest.TestCase):
    def test_normal_entrypoint_updates_reexecutes_and_preserves_account(self):
        import shutil, subprocess, sys, time, urllib.request
        source=Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            shutil.copytree(source/'mmsm',root/'mmsm',ignore=shutil.ignore_patterns('__pycache__'))
            # Dependencies/network are not under test; all other entrypoint code is real.
            (root/'mmsm/bootstrap.py').write_text('def ensure_dependencies(project): return True\n')
            db=Store(root/'data',project_root=root);db.add_user('owner','correct-horse-battery','admin');db.set_settings({'update_feed':'https://example.com/latest.json','wrapper_update_checks':False});db.db.close()
            raw=io.BytesIO()
            with zipfile.ZipFile(raw,'w') as z:
                for p in (root/'mmsm').rglob('*'):
                    if p.is_file():z.writestr(p.relative_to(root).as_posix(),p.read_bytes().replace(__version__.encode(),b'99.0.0') if p.name=='__init__.py' else p.read_bytes())
            data=raw.getvalue();(root/'release.zip').write_bytes(data)
            (root/'latest.json').write_text(json.dumps({'version':'99.0.0','url':'https://example.com/release.zip','sha256':hashlib.sha256(data).hexdigest()}))
            (root/'driver.py').write_text("from pathlib import Path\nimport mmsm.updater\nmmsm.updater.fetch=lambda url,limit:Path('latest.json' if url.endswith('json') else 'release.zip').read_bytes()\nfrom mmsm.__main__ import main\nmain()\n")
            port=support.port();base='http://127.0.0.1:'+str(port)
            with (root/'process.log').open('w+') as log:
                proc=subprocess.Popen([sys.executable,'driver.py','--port',str(port)],cwd=root,stdout=log,stderr=log)
                try:
                    for _ in range(100):
                        try:urllib.request.urlopen(base+'/api/setup',timeout=.3).close();break
                        except OSError:time.sleep(.05)
                    req=urllib.request.Request(base+'/api/login',data=json.dumps({'username':'owner','password':'correct-horse-battery'}).encode(),headers={'Content-Type':'application/json'})
                    with urllib.request.urlopen(req,timeout=3) as r:cookie=r.headers['Set-Cookie'].split(';')[0];csrf=json.load(r)['csrf']
                    headers={'Content-Type':'application/json','Cookie':cookie,'X-CSRF-Token':csrf}
                    req=urllib.request.Request(base+'/api/wrapper-update/install',data=b'{}',headers=headers)
                    with urllib.request.urlopen(req,timeout=10) as r:self.assertTrue(json.load(r)['restarting'])
                    current=None
                    for _ in range(150):
                        try:
                            with urllib.request.urlopen(urllib.request.Request(base+'/api/wrapper-update/status',headers=headers),timeout=.3) as r:current=json.load(r)['current']
                            if current=='99.0.0':break
                        except OSError:pass
                        time.sleep(.05)
                    self.assertEqual(current,'99.0.0')
                    with urllib.request.urlopen(urllib.request.Request(base+'/api/me',headers=headers),timeout=3) as r:self.assertEqual(json.load(r)['user']['username'],'owner')
                    with urllib.request.urlopen(urllib.request.Request(base+'/api/settings',headers=headers),timeout=3) as r:self.assertEqual(json.load(r)['running_bind_host'],'0.0.0.0')
                    self.assertTrue((root/'data/updates/rollback/mmsm/__init__.py').exists())
                finally:
                    proc.terminate()
                    try:proc.wait(timeout=5)
                    except subprocess.TimeoutExpired:proc.kill();proc.wait()
                    if proc.returncode not in (0,-15):log.seek(0);print(log.read())
