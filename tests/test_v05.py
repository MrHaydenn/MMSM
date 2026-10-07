"""Lifecycle races, crash reports, folder safety and preferences regressions."""
import json
import time
from unittest.mock import patch
from urllib.parse import urlparse, parse_qs
from test_manager import Base, server
import test_manager as support
import test_v02
from mmsm.manager import Manager
from mmsm.store import Problem

class Changes(Base):
    def test_queued_idle_sleep_cannot_override_stop_even_after_start_intent(self):
        s=server(self.store,sleep=True);sid=s['id'];s['launch']={'java_major':17};self.store.save_server(s)
        self.manager.set_state(sid,status='stopping',idle_token='old')
        self.manager.stop(sid)
        self.assertTrue(self.manager.stop(sid,sleeping=True,idle_token='old')['cancelled'])
        self.assertEqual(self.manager.state(sid)['status'],'stopped')
        self.manager.sleep_now(sid)
        self.assertTrue(self.manager.stop(sid,sleeping=True,idle_token='old')['cancelled'])

    def test_stop_cancels_queued_restart(self):
        s=server(self.store);sid=s['id'];jobs=[]
        with patch.object(self.manager,'spawn_job',side_effect=jobs.append):self.manager.restart(sid)
        self.assertTrue(self.manager.stop(sid)['stop_requested'])
        with patch.object(self.manager,'start') as start:jobs[0]();start.assert_not_called()
        self.assertEqual(self.manager.state(sid)['status'],'stopped')

    def test_missing_java_is_crash_with_persistent_report_and_no_ping_wake(self):
        s=server(self.store,sleep=True);sid=s['id'];s['launch']={'java':'/missing/java','java_major':21,'args':[]};self.store.save_server(s)
        with self.assertRaises(Problem):self.manager.start(sid)
        self.assertEqual(self.manager.state(sid)['status'],'crashed')
        self.assertIn('Java runtime is missing',self.manager.error_report(sid))
        with patch.object(self.manager,'spawn_job') as spawn:self.manager.wake(sid);spawn.assert_not_called()
        other=Manager(self.store,start_background=False)
        try:self.assertEqual(other.state(sid)['status'],'crashed');self.assertIn('Java runtime',other.error_report(sid))
        finally:other.close()

    def test_folder_delete_recovers_contents_removes_tracking_and_blocks_protected_paths(self):
        s=server(self.store);sid=s['id'];root=self.manager.folder(sid)
        (root/'mods').mkdir();(root/'mods/a.jar').write_bytes(b'jar')
        s['mods']=[{'project_id':'a','path':'mods/a.jar','enabled':True}];self.store.save_server(s)
        result=self.manager.delete_file(sid,'mods',True)
        self.assertEqual((self.store.root/result['backup']/'a.jar').read_bytes(),b'jar');self.assertFalse((root/'mods').exists())
        self.assertEqual(self.store.server(sid)['mods'],[])
        (root/'nested').mkdir();(root/'nested/server.properties').write_text('protected')
        for path in ('nested','','../outside'):
            with self.assertRaises(Problem):self.manager.delete_file(sid,path,True)
        (root/'links').mkdir();(root/'links/out').symlink_to(root/'nested',target_is_directory=True)
        with self.assertRaises(Problem):self.manager.delete_file(sid,'links',True)
        self.assertTrue((root/'nested/server.properties').exists())

    def test_autostart_selects_only_enabled_installed_active_servers(self):
        for name,enabled,archived,installed in [('yes',True,False,True),('off',False,False,True),('arch',True,True,True),('new',True,False,False)]:
            s=server(self.store,sid=name);s.update(autostart=enabled,archived=archived,launch={'java':'fixture'} if installed else None);self.store.save_server(s)
        jobs=[]
        with patch.object(self.manager,'spawn_job',side_effect=jobs.append):self.manager.start_configured_servers()
        self.assertEqual(len(jobs),1)
        with patch.object(self.manager,'start') as start:jobs[0]();start.assert_called_once_with('yes',automatic=True)

    def test_manual_stop_cancels_queued_autostart_and_scheduled_restart(self):
        s=server(self.store);sid=s['id'];s.update(autostart=True,launch={'java':'fixture'});self.store.save_server(s)
        jobs=[]
        with patch.object(self.manager,'spawn_job',side_effect=jobs.append):self.manager.start_configured_servers()
        self.manager.stop(sid)
        with patch.object(self.manager,'start') as start:jobs.pop()();start.assert_not_called()
        self.manager.backup_settings(sid,{'schedules':[{'id':'j','action':'restart','every':1,'unit':'seconds','enabled':True}]})
        with patch.object(self.manager,'spawn_job',side_effect=jobs.append):self.manager.run_schedules(time.time()+3)
        with patch.object(self.manager,'restart') as restart:jobs.pop()();restart.assert_not_called()
        self.assertIn('Paused by manual Stop',self.store.server(sid)['schedules'][0]['last_result'])

    def test_modrinth_sort_and_plugin_facets(self):
        with patch.object(self.manager.providers,'get',return_value={'hits':[]}) as get:
            self.manager.providers.search('test','fabric','1.21.1','plugin',0,12,'downloads')
            query=parse_qs(urlparse(get.call_args.args[0]).query)
            self.assertEqual(query['index'],['downloads']);self.assertIn(['categories:paper','categories:spigot','categories:bukkit'],json.loads(query['facets'][0]))
        with self.assertRaises(Problem):self.manager.providers.search('x','fabric','1','mod',0,12,'bad')

class JVMChanges(test_v02.ExplicitJVMControlTests):
    test_sleep_now_saves_without_waiting_for_idle_timer=None
    test_kill_interrupts_stuck_graceful_stop=None

    def test_unexpected_exit_is_crashed_but_stop_is_not(self):
        s=self.launch();sid=s['id'];self.manager.processes[sid].kill()
        for _ in range(100):
            if self.manager.state(sid)['status']=='crashed':break
            time.sleep(.02)
        self.assertEqual(self.manager.state(sid)['status'],'crashed')
        self.assertIn('Done! JVM fixture ready',self.manager.error_report(sid))
        self.manager.start(sid);self.manager.command(sid,'stop')
        self.assertEqual(self.manager.state(sid)['status'],'stopped')
        self.assertFalse(self.store.server(sid)['crash_active'])

    def test_jvm_crash_during_startup_captures_exit_code_and_output(self):
        s=self.launch();sid=s['id'];self.manager.stop(sid)
        s=self.store.server(sid);s['launch']['args'].append('--crash-on-start');self.store.save_server(s)
        self.manager.start(sid)
        for _ in range(100):
            if self.manager.state(sid)['status']=='crashed':break
            time.sleep(.02)
        self.assertEqual(self.manager.state(sid)['status'],'crashed')
        self.assertEqual(self.manager.state(sid)['exit_code'],7)
        self.assertIn('Fixture startup failure',self.manager.error_report(sid))

    def test_actual_sample_queued_sleep_is_cancelled_by_manual_stop(self):
        s=self.launch();sid=s['id'];jobs=[]
        self.manager.set_state(sid,idle_since=time.time()-3600)
        with patch.object(self.manager,'spawn_job',side_effect=jobs.append):self.manager.sample()
        self.assertEqual(len(jobs),1)
        self.manager.stop(sid);jobs[0]()
        self.assertEqual(self.manager.state(sid)['status'],'stopped');self.assertTrue(self.store.server(sid)['manual_stop'])

    def test_stop_during_backup_cancels_automatic_resume(self):
        import threading
        import zipfile
        s=self.launch();sid=s['id']
        # Configure the fixture rule directly because live configuration is intentionally blocked.
        s=self.store.server(sid);s['backup_rules']=[{'id':'rule','name':'Test','keep':2,'path':str(self.store.root/'snapshots')}];self.store.save_server(s)
        original=zipfile.ZipFile.write;workers=[]
        def write(archive,*args,**kwargs):
            if not workers:
                worker=threading.Thread(target=lambda:self.manager.stop(sid));workers.append(worker);worker.start()
                self.assertTrue(self.manager.stop_requests[sid].wait(2))
            return original(archive,*args,**kwargs)
        with patch('mmsm.features.zipfile.ZipFile.write',new=write),patch.object(self.manager,'start') as start:
            self.manager.backup(sid,'rule');start.assert_not_called()
        for worker in workers:worker.join(3);self.assertFalse(worker.is_alive())
        self.assertEqual(self.manager.state(sid)['status'],'stopped')
        self.assertTrue(self.store.server(sid)['manual_stop'])

class HTTPChanges(support.HTTPTests):
    test_setup_auth_csrf_roles_and_session_revocation=None
    test_settings_persist_and_static_security_headers=None
    test_login_rate_limit=None
    test_operator_cannot_install_or_modify_files=None

    def test_removed_preferences_and_crash_reports_require_operator(self):
        self.owner();s=server(self.store);sid=s['id'];self.manager.record_crash(sid,'fixture crash')
        order=['settings','accounts','analytics','archive','servers','dashboard']
        self.assertEqual(self.request('/api/preferences','PUT',{'nav_order':order})[0],404)
        self.assertNotIn('nav_order',self.request('/api/appearance')[1])
        self.assertEqual(self.request('/api/preferences','PUT',{'nav_order':['bad']})[0],404)
        self.assertIn('fixture crash',self.request('/api/servers/'+sid+'/error-report')[1]['text'])
        self.request('/api/users','POST',dict(username='viewer',password='correct-horse-battery',role='viewer'))
        _,body,h=self.request('/api/login','POST',dict(username='viewer',password='correct-horse-battery'))
        self.token=h['Set-Cookie'].split(';')[0];self.csrf=body['csrf']
        self.assertNotIn('nav_order',self.request('/api/appearance')[1])
        self.assertEqual(self.request('/api/servers/'+sid+'/error-report')[0],403)
