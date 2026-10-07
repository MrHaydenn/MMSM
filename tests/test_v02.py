"""Regression tests for the MMSM 0.2 update; all remote data is fixture-backed."""
import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import threading
import time
import urllib.error
import urllib.request
from urllib.parse import parse_qs,urlparse
from unittest.mock import patch

import test_manager as support
from test_manager import Base,server
from mmsm.store import Problem,Store


class FileTests(Base):
    def test_binary_upload_and_backed_up_delete(self):
        s=server(self.store);root=self.manager.folder(s['id']);(root/'mods').mkdir()
        data=bytes(range(256))*8192  # Exercises streaming past the 128 KiB chunk size.
        result=self.manager.upload_file(s['id'],'mods/uploaded.jar',io.BytesIO(data),len(data))
        self.assertEqual(result['bytes'],len(data))
        self.assertEqual((root/'mods/uploaded.jar').read_bytes(),data)
        result=self.manager.delete_file(s['id'],'mods/uploaded.jar')
        self.assertFalse((root/'mods/uploaded.jar').exists())
        self.assertEqual((self.store.root/result['backup']).read_bytes(),data)

    def test_upload_collision_interrupt_and_managed_paths(self):
        s=server(self.store);root=self.manager.folder(s['id']);(root/'old.txt').write_text('original')
        with self.assertRaises(Problem):self.manager.upload_file(s['id'],'old.txt',io.BytesIO(b'new'),3)
        self.assertEqual((root/'old.txt').read_text(),'original')
        with self.assertRaises(Problem):self.manager.upload_file(s['id'],'partial.jar',io.BytesIO(b'short'),100)
        self.assertFalse((root/'partial.jar').exists())
        self.assertFalse(list(root.parent.glob('upload-*.part')))
        for path in ['../escape','server.jar','SERVER.JAR','server.properties','libraries/foo.jar','config/unix_args.txt']:
            with self.assertRaises(Problem):self.manager.upload_file(s['id'],path,io.BytesIO(b'x'),1)
        with self.assertRaises(Problem):self.manager.upload_file(s['id'],'oversize',io.BytesIO(),513*1024**2)

    def test_delete_removes_tracking_and_refuses_folders_or_symlinks(self):
        s=server(self.store);root=self.manager.folder(s['id']);(root/'mods').mkdir();(root/'mods/demo.jar.disabled').write_bytes(b'jar')
        s['mods']=[{'project_id':'p','path':'mods/demo.jar','enabled':False}];self.store.save_server(s)
        self.manager.delete_file(s['id'],'mods/demo.jar.disabled')
        self.assertEqual(self.store.server(s['id'])['mods'],[])
        with self.assertRaises(Problem):self.manager.delete_file(s['id'],'mods')
        (root/'link').symlink_to(self.store.root/'mmsm.sqlite3')
        with self.assertRaises(Problem):self.manager.delete_file(s['id'],'link')

    def test_file_changes_blocked_while_running_or_archived(self):
        s=server(self.store);root=self.manager.folder(s['id']);(root/'test.txt').write_text('keep')
        with patch.object(self.manager,'alive',return_value=True):
            with self.assertRaises(Problem):self.manager.upload_file(s['id'],'new.jar',io.BytesIO(b'x'),1)
            with self.assertRaises(Problem):self.manager.delete_file(s['id'],'test.txt')
        self.manager.archive(s['id'],True)
        with self.assertRaises(Problem):self.manager.upload_file(s['id'],'new.jar',io.BytesIO(b'x'),1)
        with self.assertRaises(Problem):self.manager.delete_file(s['id'],'test.txt')
        self.assertEqual((root/'test.txt').read_text(),'keep')


class NewHTTPTests(support.HTTPTests):
    # Reuse the setup/request helpers without duplicating inherited test cases.
    test_setup_auth_csrf_roles_and_session_revocation=None
    test_settings_persist_and_static_security_headers=None
    test_login_rate_limit=None
    test_operator_cannot_install_or_modify_files=None

    def upload(self,sid,path,content,headers=None):
        h={'Content-Type':'application/octet-stream','Cookie':self.token or '', 'X-CSRF-Token':self.csrf or ''}
        h.update(headers or {})
        from urllib.parse import quote
        req=urllib.request.Request(self.base+'/api/servers/'+sid+'/upload?path='+quote(path),data=content,headers=h,method='POST')
        try:r=urllib.request.urlopen(req,timeout=3)
        except urllib.error.HTTPError as e:r=e
        return r.status,json.loads(r.read())

    def test_upload_auth_csrf_and_delete_routes(self):
        s=server(self.store)
        self.assertEqual(self.upload(s['id'],'new.jar',b'test')[0],401)
        self.owner()
        self.assertEqual(self.upload(s['id'],'new.jar',b'test',{'X-CSRF-Token':'bad'})[0],403)
        self.assertEqual(self.upload(s['id'],'new.jar',b'test')[0],201)
        code,result,_=self.request('/api/servers/'+s['id']+'/files','DELETE',{'path':'new.jar'})
        self.assertEqual(code,200);self.assertTrue((self.store.root/result['backup']).exists())
        self.request('/api/users','POST',dict(username='viewer',password='correct-horse-battery',role='viewer'))
        _,body,h=self.request('/api/login','POST',dict(username='viewer',password='correct-horse-battery'))
        self.token=h['Set-Cookie'].split(';')[0];self.csrf=body['csrf']
        self.assertEqual(self.upload(s['id'],'new.jar',b'test')[0],403)
        self.assertEqual(self.request('/api/servers/'+s['id']+'/files','DELETE',{'path':'new.jar'})[0],403)

    def test_download_dismissal_persists_per_account_and_keeps_audit_history(self):
        self.owner();p=self.manager.providers
        p.save_download({'id':'finished','status':'completed','name':'mod.jar'})
        p.save_download({'id':'active','status':'downloading','name':'other.jar'})
        self.assertEqual(len(self.request('/api/downloads')[1]),2)
        self.assertEqual(self.request('/api/downloads/dismiss','POST',{'id':'active'})[0],409)
        self.assertEqual(self.request('/api/downloads/dismiss','POST',{'id':'finished'})[0],200)
        self.assertEqual([r['id'] for r in self.request('/api/downloads')[1]],['active'])
        self.assertEqual(len(self.store.rows('SELECT * FROM downloads')),2)
        self.request('/api/users','POST',dict(username='other',password='correct-horse-battery',role='operator'))
        _,body,h=self.request('/api/login','POST',dict(username='other',password='correct-horse-battery'))
        self.token=h['Set-Cookie'].split(';')[0];self.csrf=body['csrf']
        self.assertEqual(len(self.request('/api/downloads')[1]),2)

    def test_search_pagination_reaches_provider(self):
        self.owner();s=server(self.store)
        with patch.object(self.manager.providers,'get',return_value={'hits':[],'total_hits':25}) as get:
            code,_,_=self.request('/api/modrinth/search?server_id='+s['id']+'&offset=24&limit=12&q=example')
            self.assertEqual(code,200)
            query=parse_qs(urlparse(get.call_args.args[0]).query)
            self.assertEqual(query['offset'],['24']);self.assertEqual(query['limit'],['12'])
        self.assertEqual(self.request('/api/modrinth/search?server_id='+s['id']+'&offset=-1')[0],400)

    def test_sleep_and_kill_roles_and_sleep_requires_toggle(self):
        self.owner();s=server(self.store)
        self.assertEqual(self.request('/api/servers/'+s['id']+'/sleep','POST',{})[0],409)
        s['sleep']=True;s['launch']={'java':'fixture'};self.store.save_server(s)
        self.assertEqual(self.request('/api/servers/'+s['id']+'/sleep','POST',{})[0],200)
        self.assertEqual(self.manager.state(s['id'])['status'],'sleeping')
        self.manager.archive(s['id'],True)
        self.assertEqual(self.request('/api/servers/'+s['id']+'/kill','POST',{})[0],409)
        self.request('/api/users','POST',dict(username='viewer',password='correct-horse-battery',role='viewer'))
        _,body,h=self.request('/api/login','POST',dict(username='viewer',password='correct-horse-battery'))
        self.token=h['Set-Cookie'].split(';')[0];self.csrf=body['csrf']
        self.assertEqual(self.request('/api/servers/'+s['id']+'/sleep','POST',{})[0],403)
        self.assertEqual(self.request('/api/servers/'+s['id']+'/kill','POST',{})[0],403)


class UpdateTests(Base):
    def test_scheduler_checks_due_servers_only_and_failure_backs_off(self):
        s=server(self.store,'due');recent=server(self.store,'recent');archived=server(self.store,'archived')
        recent['last_update_check']=time.time();self.store.save_server(recent)
        archived['archived']=True;self.store.save_server(archived)
        with patch.object(self.manager,'check_updates',side_effect=Problem('upstream offline')) as check:
            self.manager.check_due_updates();self.manager.check_due_updates()
            check.assert_called_once_with(s['id'])
        self.assertGreater(self.store.server(s['id'])['next_update_retry'],time.time())

    def test_update_notice_only_targets_current_minecraft_and_loader(self):
        s=server(self.store)
        s['mods']=[dict(project_id='p',version_id='current',enabled=True,path='mods/p.jar',name='Example',version='1',icon_url=None)]
        self.store.save_server(s)
        versions=[{'id':'wrong','version_number':'3','date_published':'2026-10-01','game_versions':['1.21.1'],'loaders':['fabric']},
                  {'id':'compatible','version_number':'2','date_published':'2026-09-01','game_versions':['1.20.1'],'loaders':['fabric']}]
        with patch.object(self.manager.providers,'mod_versions',return_value=versions),patch.object(self.manager.providers,'mod_version',return_value={'date_published':'2026-08-01'}):
            self.manager.check_updates(s['id'])
        self.assertEqual(self.store.server(s['id'])['mods'][0]['update']['id'],'compatible')
        self.assertEqual(len(self.store.rows('SELECT * FROM notifications')),1)

    def test_existing_data_and_port_survive_schema_upgrade(self):
        self.store.set_settings({'web_port':3000,'default_memory_mb':6144})
        s=server(self.store);self.store.add_user('owner','correct-horse-battery','owner',first=True)
        reopened=Store(self.store.root)
        try:
            self.assertEqual(reopened.settings()['default_memory_mb'],6144)
            self.assertEqual(reopened.settings()['web_port'],3000)
            self.assertEqual(reopened.server(s['id'])['name'],s['name'])
            self.assertEqual(len(reopened.rows('SELECT * FROM users')),1)
            self.assertTrue(reopened.rows("SELECT name FROM sqlite_master WHERE name='dismissed_downloads'"))
        finally:reopened.db.close()


class ExplicitJVMControlTests(Base):
    def launch(self,ignore_stop=False):
        java,javac=shutil.which('java'),shutil.which('javac')
        if not java:self.skipTest('Java not installed')
        compiler=[javac] if javac else [java,'com.sun.tools.javac.Main']
        classes=self.store.root/'classes';classes.mkdir()
        try:subprocess.run([*compiler,'-d',str(classes),str(Path(__file__).parent/'fixtures/TestServer.java')],check=True,capture_output=True)
        except subprocess.CalledProcessError:self.skipTest('Java compiler unavailable')
        s=server(self.store,sleep=True)
        s['launch']={'java':java,'java_major':17,'args':['-cp',str(classes),'TestServer',*(['--ignore-stop'] if ignore_stop else [])]}
        self.store.save_server(s);self.manager.start(s['id'])
        for _ in range(40):
            self.manager.sample()
            if self.manager.state(s['id'])['status']=='running':return s
            time.sleep(.05)
        self.fail('Fixture JVM did not start')

    def test_sleep_now_saves_without_waiting_for_idle_timer(self):
        s=self.launch()
        self.assertTrue(self.manager.sleep_now(s['id'])['sleeping'])
        self.assertFalse(self.manager.alive(s['id']))
        self.assertTrue((self.manager.folder(s['id'])/'world-saved.txt').exists())
        self.assertIn(s['id'],self.manager.proxies)

    def test_kill_interrupts_stuck_graceful_stop(self):
        s=self.launch(ignore_stop=True)
        errors=[]
        def stop():
            try:self.manager.stop(s['id'])
            except Exception as e:errors.append(e)
        thread=threading.Thread(target=stop);thread.start()
        for _ in range(100):
            if self.manager.state(s['id'])['status']=='stopping':break
            time.sleep(.01)
        started=time.monotonic()
        self.assertTrue(self.manager.kill(s['id'])['killed'])
        thread.join(timeout=2)
        self.assertFalse(thread.is_alive());self.assertFalse(errors)
        self.assertLess(time.monotonic()-started,3)
        self.assertEqual(self.manager.state(s['id'])['status'],'stopped')
        self.assertFalse((self.manager.folder(s['id'])/'world-saved.txt').exists())

class IconUpgradeTests(Base):
    def test_existing_mods_get_icons_without_reinstallation(self):
        s=server(self.store)
        s['mods']=[{'project_id':'p','name':'Old name','version_id':'v1'}];self.store.save_server(s)
        with patch.object(self.manager.providers,'get',return_value={'title':'Project','icon_url':'https://cdn.modrinth.com/p.png'}) as get:
            self.manager.mod_icons(s['id']);self.manager.mod_icons(s['id'])
            self.assertEqual(get.call_count,1)
        m=self.store.server(s['id'])['mods'][0]
        self.assertEqual(m['icon_url'],'https://cdn.modrinth.com/p.png');self.assertEqual(m['version_id'],'v1')
        self.manager.archive(s['id'],True)
        with self.assertRaises(Problem):self.manager.mod_icons(s['id'])
