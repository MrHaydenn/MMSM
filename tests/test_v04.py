"""Regression tests for v0.4; remote provider fixtures unless explicitly documented."""
import io
import json
from pathlib import Path
import time
from unittest.mock import patch
import test_manager as support
from test_manager import Base,server
from mmsm.manager import Manager
from mmsm.store import Problem
from mmsm.network import status


class LifecycleChanges(Base):
    def test_stop_disarms_ping_across_restart_and_sleep_now_rearms(self):
        s=server(self.store,sleep=True);s['launch']={'java_major':17};self.store.save_server(s)
        self.manager.stop(s['id']);self.assertTrue(self.store.server(s['id'])['manual_stop'])
        self.manager.ensure_proxy(s)
        with patch.object(self.manager,'spawn_job') as spawn:
            report=status(s['port']);self.assertIn('offline',report['description']['text']);spawn.assert_not_called()
        other=Manager(self.store,start_background=False)
        self.assertEqual(other.state(s['id'])['status'],'stopped');other.close()
        self.manager.configure(s['id'],{'memory_mb':2048})
        self.assertEqual(self.manager.state(s['id'])['status'],'stopped')
        self.manager.sleep_now(s['id']);self.assertFalse(self.store.server(s['id'])['manual_stop'])
        jobs=[]
        with patch.object(self.manager,'spawn_job',side_effect=jobs.append):
            report=status(s['port']);self.assertIn('Waking',report['description']['text'])
        self.assertEqual(len(jobs),1)
        # A delayed ping must not undo a newer, explicit stop.
        self.manager.stop(s['id'])
        with patch.object(self.manager,'start') as start:jobs[0]();start.assert_not_called()

    def test_delete_requires_name_and_idle_and_keeps_unrelated_files_and_backups(self):
        s=server(self.store);sid=s['id'];root=self.manager.folder(sid)
        (root/'world.dat').write_bytes(b'world')
        unrelated=self.store.root/'keep.txt';unrelated.write_text('keep')
        backup=self.store.root/'backups'/'keep.zip';backup.write_bytes(b'backup')
        with self.assertRaises(Problem):self.manager.delete_server(sid,'wrong name')
        with patch.object(self.manager,'alive',return_value=True):
            with self.assertRaises(Problem):self.manager.delete_server(sid,s['name'])
        self.store.notify(sid,'Notice');self.manager.record_usage(sid,time.time(),5,{'players':1},(50,30),(0,0))
        user=self.store.add_user('scoped','correct-horse-battery','viewer');self.store.execute('UPDATE users SET server_ids=? WHERE id=?',(json.dumps([sid]),user['id']))
        self.manager.ensure_proxy(s)
        result=self.manager.delete_server(sid,s['name']);self.assertTrue(result['deleted']);self.assertFalse(root.exists())
        self.assertEqual(self.store.servers(),[]);self.assertEqual(self.store.rows('SELECT * FROM notifications'),[])
        self.assertEqual(self.store.rows('SELECT * FROM usage_hourly'),[]);self.assertNotIn(sid,self.manager.proxies)
        self.assertEqual(json.loads(self.store.rows('SELECT server_ids FROM users')[0]['server_ids']),[])
        self.assertTrue(unrelated.exists() and backup.exists());self.assertFalse(self.store.rows('SELECT * FROM server_deletions'))

    def test_locked_deleted_files_do_not_prevent_manager_startup(self):
        s=server(self.store);sid=s['id'];(self.manager.folder(sid)/'world.dat').write_bytes(b'world')
        with patch('mmsm.maintenance.shutil.rmtree',side_effect=PermissionError('File locked')):
            result=self.manager.delete_server(sid,s['name']);self.assertIn('warning',result)
            self.manager.recover_deletions()
        self.assertTrue(self.store.rows('SELECT * FROM server_deletions'))
        self.manager.recover_deletions();self.assertEqual(self.store.rows('SELECT * FROM server_deletions'),[])

    def test_failed_delete_transaction_restores_world_and_journal_recovery(self):
        s=server(self.store);sid=s['id'];root=self.manager.folder(sid);(root/'world.dat').write_bytes(b'preserved')
        self.store.execute("CREATE TRIGGER refuse_delete BEFORE DELETE ON servers BEGIN SELECT RAISE(ABORT,'fixture failure'); END")
        with self.assertRaises(Exception):self.manager.delete_server(sid,s['name'])
        self.assertEqual((root/'world.dat').read_bytes(),b'preserved');self.assertTrue(self.store.server(sid))
        self.store.execute('DROP TRIGGER refuse_delete')
        tomb=root.with_name('.mmsm-delete-test');root.rename(tomb)
        self.store.execute('INSERT INTO server_deletions VALUES(?,?,?)',(sid,str(root),str(tomb)))
        self.manager.recover_deletions();self.assertTrue((root/'world.dat').exists());self.assertFalse(tomb.exists())
        self.manager.archive(sid,True);self.assertTrue(self.manager.delete_server(sid,s['name'])['deleted'])


class HistoryTests(Base):
    def test_history_limits_count_bytes_age_active_preservation_and_dismissal(self):
        now=time.time()
        entries=[{'id':str(i),'name':'file'+str(i),'status':'completed','created':now+i,'destination':'Servers/Test/mods/x.jar'} for i in range(8)]
        entries+=[{'id':'old','status':'completed','created':now-91*86400},{'id':'active','status':'downloading','created':now-99*86400}]
        for d in entries:self.store.execute('INSERT INTO downloads VALUES(?,?)',(d['id'],json.dumps(d)))
        self.store.execute('INSERT INTO dismissed_downloads VALUES(?,?)',('u','old'))
        self.store.prune_downloads(max_records=5)
        history=self.store.download_history(page=0);self.assertEqual(history['total'],6)
        self.assertEqual(len(self.store.download_history(user_id='u')),4) # all active + three completed
        self.assertEqual(self.store.rows('SELECT * FROM dismissed_downloads'),[])
        self.store.execute('INSERT INTO dismissed_downloads VALUES(?,?)',('u','7'))
        self.assertNotIn('7',[d['id'] for d in self.store.download_history(user_id='u')]);self.assertIn('7',[d['id'] for d in self.store.download_history(page=0)['items']])
        self.store.prune_downloads(max_bytes=1)
        self.assertEqual([d['id'] for d in self.store.download_history(page=0)['items']],['active'])

    def test_history_records_source_destination_and_final_mod_location(self):
        s=server(self.store);root=self.manager.folder(s['id']);stage=root/'temp.jar';dest=root/'mods'/'actual.jar'
        raw=b'fixture';url='https://cdn.modrinth.com/fixture.jar'
        class Response(io.BytesIO):headers={}
        with patch.object(self.manager.providers,'open',return_value=Response(raw)):
            self.manager.providers.download(url,stage,sid=s['id'])
        self.manager.providers.mark_installed(s['id'],stage,dest)
        d=self.store.download_history(page=0)['items'][0]
        self.assertEqual(d['destination'],str(stage));self.assertEqual(d['installed_to'],str(dest));self.assertEqual(d['source'],url);self.assertEqual(d['server_name'],s['name'])

    def test_player_hours_and_network_totals_are_bounded_scoped_and_archive_aware(self):
        a=server(self.store,'a');b=server(self.store,'b');now=time.time()
        self.manager.record_usage('a',now,5,{'players':2},(1000,2000),(100,500))
        self.manager.record_usage('a',now+1,999,{'players':3},(1100,2400),(1000,2000))
        self.manager.record_usage('a',now+2,5,{'players':None},(1200,2500),(1100,2400))
        self.manager.record_usage('b',now,5,{'players':100},(99999,99999),(0,0))
        result=self.manager.usage_history(30,['a'],now+3)
        self.assertAlmostEqual(result['totals']['player_hours'],40/3600)
        self.assertEqual(result['totals']['rx_bytes'],1100);self.assertEqual(result['totals']['tx_bytes'],2000)
        self.assertEqual(len(result['series']),30);self.assertEqual(len(result['servers']),1)
        self.manager.archive('a',True);self.assertEqual(self.manager.usage_history(7,['a'])['totals']['rx_bytes'],0)
        with self.assertRaises(Problem):self.manager.usage_history(9999)


class CompatibleVersionTests(Base):
    def versions(self,s):
        base={'project_id':'project','game_versions':[s['minecraft']],'loaders':[s['loader']],'files':[{'filename':'mod.jar'}],'version_type':'release'}
        return [{**base,'id':'old','version_number':'Old','date_published':'2026-01-01T00:00:00Z'},
                {**base,'id':'new','version_number':'New','date_published':'2026-02-01T00:00:00Z'},
                {**base,'id':'wrong','game_versions':['other'],'date_published':'2026-03-01T00:00:00Z'}]

    def test_latest_selected_by_publication_and_explicit_version_validated(self):
        s=server(self.store);project={'id':'project','project_type':'mod','server_side':'optional'}
        with patch.object(self.manager.providers,'get',return_value=project),patch.object(self.manager.providers,'mod_versions',return_value=self.versions(s)),patch.object(self.manager,'mod_install',return_value={'queued':True}) as install:
            versions=self.manager.compatible_project_versions(s['id'],'project');self.assertEqual([v['id'] for v in versions],['new','old'])
            self.manager.install_project(s['id'],{'project_id':'project'});install.assert_called_with(s['id'],'new')
            self.manager.install_project(s['id'],{'project_id':'project','version_id':'old'});install.assert_called_with(s['id'],'old')
            with self.assertRaises(Problem):self.manager.install_project(s['id'],{'project_id':'project','version_id':'wrong'})
        with patch.object(self.manager.providers,'get',return_value=dict(project,server_side='unsupported')):
            with self.assertRaises(Problem):self.manager.compatible_project_versions(s['id'],'project')

    def test_missing_labels_use_artifact_name_and_bad_ids_raise_actionable_error(self):
        s=server(self.store);versions=self.versions(s)[:1];versions[0].pop('version_number')
        with patch.object(self.manager.providers,'get',return_value={'id':'project','project_type':'mod'}),patch.object(self.manager.providers,'mod_versions',return_value=versions):
            self.assertEqual(self.manager.compatible_project_versions(s['id'],'project')[0]['version_number'],'mod.jar')
            versions[0].pop('id')
            with self.assertRaisesRegex(Problem,'incomplete version'):self.manager.compatible_project_versions(s['id'],'project')


class HTTPChanges(support.HTTPTests):
    test_setup_auth_csrf_roles_and_session_revocation=None
    test_settings_persist_and_static_security_headers=None
    test_login_rate_limit=None
    test_operator_cannot_install_or_modify_files=None

    def test_delete_scopes_confirmation_and_analytics_history_authorization(self):
        self.owner();s=server(self.store);other=server(self.store,'other');sid=s['id']
        self.assertEqual(self.request('/api/servers/'+sid,'DELETE',{'confirm_name':'wrong'})[0],400)
        self.assertEqual(self.request('/api/users','POST',{'username':'limited','password':'correct-horse-battery','role':'admin','server_ids':[sid]})[0],201)
        code,login,h=self.request('/api/login','POST',{'username':'limited','password':'correct-horse-battery'});self.token=h['Set-Cookie'].split(';')[0];self.csrf=login['csrf']
        self.assertEqual(self.request('/api/servers/other','DELETE',{'confirm_name':other['name']})[0],404)
        self.assertEqual(self.request('/api/analytics?days=30')[0],200)
        self.assertEqual([r['id'] for r in self.request('/api/analytics?days=30')[1]['servers']],[sid])
        self.assertEqual(self.request('/api/download-history')[0],200)
        self.assertEqual(self.request('/api/servers/'+sid,'DELETE',{'confirm_name':s['name']})[0],200)
        self.assertEqual(self.request('/api/servers')[1],[])

    def test_compatible_versions_and_one_click_install_routes(self):
        self.owner();s=server(self.store);project={'id':'project','project_type':'mod','server_side':'optional'}
        versions=CompatibleVersionTests.versions(self,s)
        with patch.object(self.manager.providers,'get',return_value=project),patch.object(self.manager.providers,'mod_versions',return_value=versions),patch.object(self.manager,'mod_install',return_value={'queued':True}) as install:
            code,data,_=self.request('/api/modrinth/compatible?server_id='+s['id']+'&project=project');self.assertEqual(code,200);self.assertEqual(data['latest_id'],'new')
            code,data,_=self.request('/api/servers/'+s['id']+'/project-install','POST',{'project_id':'project','type':'mod'});self.assertEqual(code,200);self.assertEqual(data['version_id'],'new');install.assert_called_with(s['id'],'new')

    def test_navbar_hover_theme_and_three_recent_history(self):
        self.owner()
        self.assertEqual(self.request('/api/settings','PUT',{'theme':'midnight'})[0],200)
        css=self.request('/theme.css')[1];self.assertIn('--navbar:#0e1729',css);self.assertIn('--hover:#263e60',css)
        for i in range(55):self.manager.providers.save_download({'id':str(i),'name':'file','created':time.time()+i,'status':'completed','bytes':10})
        self.assertEqual(len(self.request('/api/downloads')[1]),3)
        history=self.request('/api/download-history')[1];self.assertEqual(history['total'],55);self.assertEqual(len(history['items']),50)
        self.assertEqual(len(self.request('/api/download-history?page=1')[1]['items']),5)


import test_v02 as controls
class JVMStopChanges(controls.ExplicitJVMControlTests):
    test_sleep_now_saves_without_waiting_for_idle_timer=None
    test_kill_interrupts_stuck_graceful_stop=None
    def test_explicit_stop_then_real_start_rearms_sleep(self):
        s=self.launch();sid=s['id']
        self.manager.stop(sid)
        self.assertTrue(self.store.server(sid)['manual_stop'])
        self.assertEqual(self.manager.state(sid)['status'],'stopped')
        self.manager.start(sid)
        self.assertFalse(self.store.server(sid)['manual_stop'])
        self.assertTrue(self.manager.alive(sid))
