"""v0.3 offline integration tests. Network services use recorded-shape fixtures."""
import base64
import io
import json
from pathlib import Path
import subprocess
import time
import zipfile
from unittest.mock import patch

import test_manager as support
import test_v02 as controls
from test_manager import Base,server
from mmsm.store import Problem
from mmsm.manager import Manager
from mmsm.images import image_bytes, minecraft_head
from mmsm.bootstrap import ensure_dependencies
from mmsm.providers import FABRIC


class StorageAndBackupTests(Base):
    def test_migration_names_collisions_and_rename_preserve_world(self):
        a=server(self.store,'a');b=server(self.store,'b')
        (self.manager.folder('a')/'level.dat').write_bytes(b'world')
        self.manager.initialize_features()
        a=self.store.server('a');b=self.store.server('b')
        self.assertEqual(a['directory'],'Test world');self.assertNotEqual(a['directory'],b['directory'])
        self.assertEqual(self.manager.folder('a'),self.store.project_root/'Servers'/'Test world')
        self.assertEqual((self.manager.folder('a')/'level.dat').read_bytes(),b'world')
        self.manager.initialize_features() # Idempotent across restarts.
        self.manager.configure('a',{'name':'New world'})
        self.assertEqual(self.manager.folder('a').name,'New world')
        self.assertEqual((self.manager.folder('a')/'level.dat').read_bytes(),b'world')
        self.assertFalse((self.store.servers_root/'Test world').exists())

    def test_backup_path_retention_and_rule_isolation(self):
        s=server(self.store);sid=s['id'];root=self.manager.folder(sid)
        (root/'world').mkdir();(root/'world'/'level.dat').write_bytes(b'saved world')
        dest=self.store.project_root/'custom-backups';dest.mkdir();(dest/'keep.txt').write_text('untouched')
        rules=[{'id':'daily','name':'Daily','keep':2,'path':str(dest)},{'id':'weekly','name':'Weekly','keep':1,'path':str(dest)}]
        self.manager.backup_settings(sid,{'backup_rules':rules})
        weekly=self.manager.backup(sid,'weekly')
        daily=[self.manager.backup(sid,'daily') for _ in range(3)]
        self.assertFalse(Path(daily[0]['path']).exists());self.assertTrue(Path(weekly['path']).exists())
        with zipfile.ZipFile(daily[-1]['path']) as z:self.assertEqual(z.read('world/level.dat'),b'saved world')
        self.assertEqual((dest/'keep.txt').read_text(),'untouched')
        self.assertEqual(len(self.store.rows('SELECT * FROM backup_records')),3)
        with self.assertRaises(Problem):self.manager.backup_settings(sid,{'backup_rules':[dict(rules[0],path=str(root/'backups'))]})
        (root/'outside').symlink_to(self.store.root/'mmsm.sqlite3')
        with self.assertRaises(Problem):self.manager.backup(sid,'daily')
        self.assertFalse(list(dest.glob('*.part')))

    def test_schedule_intervals_persistence_archive_and_no_duplicate_claim(self):
        s=server(self.store);sid=s['id']
        self.manager.backup_settings(sid,{'backup_rules':[{'id':'r','name':'Snapshot','keep':2,'path':''}],
            'schedules':[{'id':'j','action':'backup','rule_id':'r','every':2,'unit':'weeks','enabled':True}]})
        task=self.store.server(sid)['schedules'][0]
        self.assertAlmostEqual(task['next_run']-time.time(),1209600,delta=2)
        now=task['next_run']+1;callbacks=[]
        with patch.object(self.manager,'spawn_job',side_effect=callbacks.append):
            self.manager.run_schedules(now);self.manager.run_schedules(now)
        self.assertEqual(len(callbacks),1)
        callbacks[0]()
        self.assertEqual(self.store.server(sid)['schedules'][0]['last_result'],'Completed')
        self.manager.archive(sid,True)
        with patch.object(self.manager,'spawn_job') as spawn:self.manager.run_schedules(now+9999999);spawn.assert_not_called()

    def test_eula_global_setting_and_named_creation(self):
        data={'name':'New server','loader':'vanilla','minecraft':'1.20.1','loader_version':'1.20.1','port':support.port(),'eula':True}
        self.assertTrue(self.store.settings()['auto_eula'])
        self.store.set_settings({'auto_eula':False})
        with self.assertRaises(Problem):self.manager.create(data)
        self.store.set_settings({'auto_eula':True})
        with patch.object(self.manager,'job',return_value={'queued':True}):result=self.manager.create(data)
        self.assertEqual(self.manager.folder(result['id']),self.store.servers_root/'New server')
        self.assertTrue(self.manager.folder(result['id']).is_dir())


class PlayerAndImageTests(Base):
    def test_player_lists_log_requests_and_offline_actions(self):
        s=server(self.store);sid=s['id'];self.manager.write_properties(s,{'online-mode':'false'})
        self.manager.player_action(sid,{'name':'MrHaydenn','action':'whitelist'})
        self.manager.player_action(sid,{'name':'MrHaydenn','action':'op'})
        self.manager.player_action(sid,{'name':'BadPlayer','action':'ban'})
        self.manager.player_log(sid,'[Server thread/INFO]: MrHaydenn joined the game')
        self.manager.player_log(sid,'[Server thread/INFO]: NewPlayer lost connection: You are not white-listed on this server!')
        self.manager.player_log(sid,'[Server thread/INFO]: NewPlayer lost connection: You are not white-listed on this server!')
        with patch.object(self.manager,'alive',return_value=True):players=self.manager.players(sid)
        hayden=next(p for p in players['players'] if p['name']=='MrHaydenn')
        self.assertTrue(hayden['op'] and hayden['whitelisted'] and hayden['online'])
        self.assertEqual(len(players['requests']),1)
        self.assertTrue(next(p for p in players['players'] if p['name']=='BadPlayer')['banned'])
        self.manager.player_action(sid,{'name':'MrHaydenn','action':'deop'})
        self.assertFalse(next(p for p in self.manager.players(sid)['players'] if p['name']=='MrHaydenn').get('op'))
        with self.assertRaises(Problem):self.manager.player_action(sid,{'name':'a\nstop','action':'op'})

    def test_image_resize_skin_overlay_cache_and_bad_images(self):
        from PIL import Image
        source=io.BytesIO();Image.new('RGB',(300,150),'red').save(source,format='JPEG')
        png=image_bytes(source.getvalue());im=Image.open(io.BytesIO(png))
        self.assertEqual(im.size,(64,64));self.assertEqual(im.format,'PNG')
        skin=Image.new('RGBA',(64,64),(0,0,0,0));skin.paste((255,0,0,255),(8,8,16,16));skin.paste((0,255,0,255),(40,8,44,16))
        raw=io.BytesIO();skin.save(raw,format='PNG')
        texture=base64.b64encode(json.dumps({'textures':{'SKIN':{'url':'http://textures.minecraft.net/texture/abcdef'}}}).encode()).decode()
        with patch.object(self.manager.providers,'get',side_effect=[{'id':'a'*32},{'properties':[{'name':'textures','value':texture}]},raw.getvalue()]) as get:
            face=minecraft_head(self.manager,'MrHaydenn');self.assertEqual(face,minecraft_head(self.manager,'MrHaydenn'));self.assertEqual(get.call_count,3)
        face=Image.open(io.BytesIO(face));self.assertEqual(face.getpixel((0,0)),(0,255,0,255));self.assertEqual(face.getpixel((63,0)),(255,0,0,255))
        with self.assertRaises(Problem):image_bytes(b'not image')

    def test_dependencies_use_project_local_target_and_fail_gracefully(self):
        with patch('mmsm.bootstrap.subprocess.run') as run,patch('mmsm.bootstrap.importlib.import_module',side_effect=[ImportError(),ImportError(),object(),object()]):
            self.assertTrue(ensure_dependencies(self.store.project_root))
        argv=run.call_args.args[0];self.assertIn('--target',argv);self.assertIn(str(self.store.project_root/'dependencies'),argv)
        with patch('mmsm.bootstrap.subprocess.run',side_effect=subprocess.TimeoutExpired('pip',180)),patch('mmsm.bootstrap.importlib.import_module',side_effect=ImportError()):
            self.assertFalse(ensure_dependencies(self.store.project_root))


class ReleaseTests(Base):
    def test_experimental_filter_uses_release_metadata_and_loader_stability(self):
        p=self.manager.providers
        with patch.object(p,'minecraft',return_value=[{'id':'26.3','type':'release'},{'id':'26.4-snapshot-1','type':'snapshot'}]),patch.object(p,'catalog',return_value={'minecraft':['26.4-snapshot-1','26.3'],'versions':['1.0-beta','1.0']}),patch.object(p,'get',return_value=[{'loader':{'version':'1.0','stable':True}},{'loader':{'version':'1.0-beta','stable':False}}]):
            result=self.manager.stable_catalog('fabric','26.3');self.assertEqual(result['minecraft'],['26.3']);self.assertEqual(result['versions'],['1.0'])
            self.assertEqual(len(self.manager.stable_catalog('fabric','26.3',True)['minecraft']),2)
            self.assertEqual(self.manager.stable_catalog('fabric','26.4-snapshot-1')['versions'],[])

    def test_new_minecraft_runtime_notice_is_actionable_and_deduplicated(self):
        s=server(self.store);s.update(minecraft='26.3',loader_version='0.18.0');self.store.save_server(s)
        with patch.object(self.manager,'stable_catalog',return_value={'minecraft':['26.4','26.3'],'versions':['0.18.1']}):
            self.manager.check_runtime_updates(s['id']);self.manager.check_runtime_updates(s['id'])
        rows=self.store.rows("SELECT * FROM notifications WHERE kind='runtime'")
        self.assertEqual(len(rows),1);self.assertEqual(json.loads(rows[0]['payload'])['minecraft'],'26.4')
        self.assertEqual(json.loads(rows[0]['payload'])['tab'],'config')


class ScopedHTTPTests(support.HTTPTests):
    test_setup_auth_csrf_roles_and_session_revocation=None
    test_settings_persist_and_static_security_headers=None
    test_login_rate_limit=None
    test_operator_cannot_install_or_modify_files=None

    def sign_in(self,username):
        code,data,h=self.request('/api/login','POST',{'username':username,'password':'correct-horse-battery'})
        self.assertEqual(code,200);self.token=h['Set-Cookie'].split(';')[0];self.csrf=data['csrf']

    def test_server_scopes_cover_routes_aggregates_notifications_downloads(self):
        self.owner();a=server(self.store,'allowed');b=server(self.store,'hidden')
        self.manager.latest={'host':{'cpu':50,'ram_used':200},'servers':{'allowed':{'players':2,'cpu':1},'hidden':{'players':50,'cpu':20}}}
        for sid in ('allowed','hidden'):
            self.store.notify(sid,sid,kind='runtime',payload={'tab':'config'})
            self.manager.providers.save_download({'id':sid,'server_id':sid,'status':'completed'})
            self.store.execute('INSERT INTO metrics(server_id,ts,data) VALUES(?,?,?)',(sid,time.time(),json.dumps({'players':2 if sid=='allowed' else 50})))
        code,_,_=self.request('/api/users','POST',{'username':'limited','password':'correct-horse-battery','role':'admin','server_ids':['allowed']});self.assertEqual(code,201)
        self.sign_in('limited')
        self.assertEqual([s['id'] for s in self.request('/api/servers')[1]],['allowed'])
        self.assertEqual(self.request('/api/dashboard')[1]['minecraft']['players'],2)
        self.assertEqual(self.request('/api/history')[1][0]['players'],2)
        self.assertEqual(len(self.request('/api/notifications')[1]),1);self.assertEqual(len(self.request('/api/downloads')[1]),1)
        for suffix in ('','/files','/logs','/properties','/history','/players','/backups','/icon','/head?name=Steve'):
            self.assertEqual(self.request('/api/servers/hidden'+suffix)[0],404,suffix)
        for suffix in ('start','restart','mods-install','upload','icon','backups','players'):
            self.assertEqual(self.request('/api/servers/hidden/'+suffix,'POST',{})[0],404,suffix)
        self.assertEqual(self.request('/api/modrinth/search?server_id=hidden')[0],404)
        self.assertEqual(self.request('/api/users')[0],403)
        self.assertEqual(self.request('/api/settings','PUT',{'auto_eula':True})[0],403)
        self.assertEqual(self.request('/api/servers/allowed/players')[0],200)

    def test_settings_eula_theme_request_actions_and_icon(self):
        from PIL import Image
        self.owner();s=server(self.store);sid=s['id'];self.manager.write_properties(s,{'online-mode':'false'})
        self.assertEqual(self.request('/api/settings','PUT',{'auto_eula':True,'theme':'ember'})[0],200)
        self.assertIn('#ffb277',self.request('/theme.css')[1])
        self.assertEqual(self.request('/api/settings','PUT',{'accent_color':'red;display:none'})[0],400)
        self.manager.player_log(sid,'[Server thread/INFO]: NewPlayer lost connection: You are not whitelisted on this server!')
        note=self.request('/api/notifications')[1][0]
        self.assertEqual(self.request('/api/notifications/action','POST',{'id':note['id'],'action':'whitelist'})[0],200)
        self.assertTrue(self.request('/api/servers/'+sid+'/players')[1]['players'][0]['whitelisted'])
        self.assertEqual(self.request('/api/notifications')[1][0]['resolved'],1)
        raw=io.BytesIO();Image.new('RGB',(200,100),'blue').save(raw,format='PNG')
        payload={'image':base64.b64encode(raw.getvalue()).decode()}
        self.assertEqual(self.request('/api/servers/'+sid+'/icon','POST',payload)[0],200)
        with Image.open(self.manager.folder(sid)/'server-icon.png') as icon:self.assertEqual(icon.size,(64,64))
        self.assertTrue(self.request('/api/servers/'+sid)[1]['icon'])
        self.assertEqual(self.request('/api/profile','POST',payload)[0],200)
        self.assertTrue(self.request('/api/me')[1]['user']['avatar'])
        self.assertEqual(self.request('/api/assets/logo','POST',payload)[0],200)
        self.assertTrue(self.request('/api/appearance')[1]['logo'])

    def test_notification_read_is_per_account_and_unarchive_still_works(self):
        self.owner();s=server(self.store);self.store.notify(s['id'],'New release',kind='runtime')
        self.request('/api/notifications/read','POST',{})
        self.assertEqual(self.request('/api/notifications')[1][0]['seen'],1)
        self.request('/api/users','POST',{'username':'other','password':'correct-horse-battery','role':'admin'})
        self.sign_in('other');self.assertEqual(self.request('/api/notifications')[1][0]['seen'],0)
        self.assertEqual(self.request('/api/servers/'+s['id']+'/archive','POST',{})[0],200)
        self.assertEqual(self.request('/api/notifications')[1],[])
        self.assertEqual(self.request('/api/servers/'+s['id']+'/unarchive','POST',{})[0],200)


class JVMBackupTests(controls.ExplicitJVMControlTests):
    test_sleep_now_saves_without_waiting_for_idle_timer=None
    test_kill_interrupts_stuck_graceful_stop=None
    def test_live_backup_saves_world_and_resumes_then_restart_replaces_process(self):
        s=self.launch();sid=s['id'];original=self.manager.processes[sid].pid
        self.manager.backup_settings(sid,{'backup_rules':[{'id':'r','name':'Live','keep':2,'path':''}]})
        result=self.manager.backup(sid,'r')
        with zipfile.ZipFile(result['path']) as z:self.assertIn('world-saved.txt',z.namelist())
        self.assertTrue(self.manager.alive(sid));self.assertNotEqual(self.manager.processes[sid].pid,original)
        second=self.manager.processes[sid].pid
        # Wait until Java can accept stop, then exercise the queued restart.
        for _ in range(40):
            self.manager.sample()
            if self.manager.state(sid)['status']=='running':break
            time.sleep(.05)
        self.manager.restart(sid)
        for _ in range(100):
            if self.manager.alive(sid) and self.manager.processes[sid].pid!=second:break
            time.sleep(.03)
        self.assertTrue(self.manager.alive(sid));self.assertNotEqual(self.manager.processes[sid].pid,second)
