import os
import time
from unittest.mock import patch
import test_manager as support
from mmsm.store import Problem

class SleepChecks(support.Base):
    def test_player_join_unknown_status_and_stop_reset_or_pause_timer(self):
        s=support.server(self.store,sleep=True);sid=s['id'];s['idle_minutes']=5;self.store.save_server(s)
        class Process:
            pid=os.getpid()
            def poll(self):return None
        self.manager.processes[sid]=Process()
        self.manager.set_state(sid,status='running',idle_since=time.time()-600)
        try:
            with patch('mmsm.manager.status',return_value={'players':{'online':1}}),patch.object(self.manager,'spawn_job') as spawn:
                self.manager.sample();spawn.assert_not_called()
                self.assertIsNone(self.manager.state(sid)['idle_since'])
                self.assertIn('players are online',self.manager.sleep_info(s)['reason'])
            with patch('mmsm.manager.status',side_effect=OSError('timeout')),patch.object(self.manager,'spawn_job') as spawn:
                self.manager.sample();spawn.assert_not_called()
                self.assertIn('player status check failed',self.manager.sleep_info(s)['reason'])
                self.assertEqual(self.manager.sleep_info(s)['error'],'timeout')
            with patch('mmsm.manager.status',return_value={'players':{'online':0}}),patch.object(self.manager,'spawn_job') as spawn:
                self.manager.sample();spawn.assert_not_called()
                self.assertGreater(self.manager.sleep_info(s)['remaining_seconds'],299)
                s['manual_stop']=True;self.store.save_server(s)
                self.manager.set_state(sid,idle_since=time.time()-600)
                self.manager.sample();spawn.assert_not_called()
                self.assertIn('paused by Stop',self.manager.sleep_info(s)['reason'])
        finally:self.manager.processes.clear()

class SyncLocalSettings(support.HTTPTests):
    test_setup_auth_csrf_roles_and_session_revocation=None
    test_settings_persist_and_static_security_headers=None
    test_login_rate_limit=None
    test_operator_cannot_install_or_modify_files=None
    def test_legacy_sync_keeps_local_settings_and_only_guards_selected_content(self):
        self.owner();source=support.server(self.store,'source');target=support.server(self.store,'target')
        src=self.manager.folder('source');dst=self.manager.folder('target')
        (src/'config').mkdir();(src/'config/a.txt').write_text('source')
        self.manager.syncs.save('target',{'source_id':'source','folders':['config'],'runtime':False,'settings':True,'confirm':True})
        legacy=self.store.server('target');legacy['sync']['settings']=True;self.store.save_server(legacy)
        code,_,_=self.request('/api/servers/target/configure','PUT',{'sleep':True,'idle_minutes':5,'memory_mb':2048,'autostart':True})
        self.assertEqual(code,200);self.assertIn('sync',self.store.server('target'))
        self.assertEqual(self.request('/api/servers/target/properties','PUT',{'values':{'motd':'local'}})[0],200)
        source.update(sleep=False,idle_minutes=15,memory_mb=4096);self.store.save_server(source)
        self.manager.write_properties(source,{'motd':'remote'})
        (src/'config/a.txt').write_text('updated')
        self.assertEqual(self.manager.syncs.run('target')['status'],'Up to date')
        saved=self.store.server('target')
        self.assertEqual((saved['sleep'],saved['idle_minutes'],saved['memory_mb'],saved['autostart']),(True,5,2048,True))
        self.assertNotIn('settings',saved['sync'])
        self.assertEqual(self.manager.properties('target')['motd'],'local')
        self.assertEqual((self.manager.folder('target')/'config/a.txt').read_text(),'updated')
        self.assertEqual(self.request('/api/servers/target/files','PUT',{'path':'notes.txt','content':'local'})[0],200)
        self.assertIn('sync',self.store.server('target'))
        self.assertEqual(self.request('/api/servers/target/sync-edit','POST',{'resource':'files','paths':['notes.txt']})[0],200)
        self.assertEqual(self.request('/api/servers/target/sync-edit','POST',{'resource':'files','paths':['config/new.txt']})[0],409)
        self.assertEqual(self.request('/api/servers/target/files','PUT',{'path':'config/a.txt','content':'manual'})[0],409)
        self.assertEqual(self.request('/api/servers/target/files','PUT',{'path':'config/a.txt','content':'manual'},{'X-MMSM-Unlink-Sync':'true'})[0],200)
        self.assertNotIn('sync',self.store.server('target'))

    def test_runtime_and_mod_guards_only_apply_when_followed(self):
        self.owner();support.server(self.store,'source');s=support.server(self.store,'target')
        s['sync']={'source_id':'source','folders':['config'],'runtime':False};self.store.save_server(s)
        self.manager.syncs.guard('target',resource='runtime')
        self.manager.syncs.guard('target',resource='mods')
        self.assertIn('sync',self.store.server('target'))
        s['sync']['runtime']=True;self.store.save_server(s)
        with self.assertRaises(Problem):self.manager.syncs.guard('target',resource='runtime')
        s['sync'].update(runtime=False,folders=['mods']);self.store.save_server(s)
        with self.assertRaises(Problem):self.manager.syncs.guard('target',resource='mods')
