import json
from pathlib import Path
from unittest.mock import patch
import test_manager as support
from mmsm.store import Problem, GITHUB_UPDATE_FEED
from mmsm.domains import plan, save, validate_settings


class SyncTests(support.Base):
    def setUp(self):
        super().setUp()
        self.a = support.server(self.store, 'source'); self.b = support.server(self.store, 'target')
        self.src = self.manager.folder('source'); self.dst = self.manager.folder('target')
        for folder in (self.src, self.dst): (folder / 'config').mkdir()
        (self.src / 'config/options.txt').write_text('new')
        (self.dst / 'config/options.txt').write_text('old')
        self.rule = {'source_id': 'source', 'folders': ['config'], 'confirm': True, 'runtime': False}

    def test_mirror_updates_deletes_backup_and_manual_unlink(self):
        self.assertEqual(self.manager.syncs.save('target', self.rule)['status'], 'Up to date')
        self.assertEqual((self.dst / 'config/options.txt').read_text(), 'new')
        self.assertEqual((self.store.root / 'sync-backups/target/config/options.txt').read_text(), 'old')
        (self.src / 'config/options.txt').unlink(); (self.src / 'config/added.txt').write_text('added')
        self.assertEqual(self.manager.syncs.run('target')['status'], 'Up to date')
        self.assertFalse((self.dst / 'config/options.txt').exists())
        with self.assertRaises(Problem): self.manager.syncs.guard('target')
        self.manager.syncs.guard('target', True)
        self.assertNotIn('sync', self.store.server('target'))

    def test_external_edits_pause_and_running_archived_sources_are_dormant(self):
        self.manager.syncs.save('target', self.rule)
        (self.dst / 'config/options.txt').write_text('local')
        self.assertIn('outside MMSM', self.manager.syncs.run('target')['status'])
        self.assertEqual((self.dst / 'config/options.txt').read_text(), 'local')
        with patch.object(self.manager, 'alive', return_value=True):
            self.assertIn('Paused', self.manager.syncs.run('target')['status'])
        self.a['archived'] = True; self.store.save_server(self.a)
        self.assertIn('Archived', self.manager.syncs.run('target')['status'])

    def test_symlinks_worlds_chains_and_loader_mismatch_blocked(self):
        for name in ('world', '../escape', '.fabric', 'libraries'):
            with self.assertRaises(Problem): self.manager.syncs.save('target', {**self.rule, 'folders': [name]})
        (self.src / 'config/link').symlink_to(self.dst / 'config/options.txt')
        self.assertIn('symlinks', self.manager.syncs.save('target', self.rule)['status'])
        (self.src / 'config/link').unlink()
        with self.assertRaises(Problem): self.manager.syncs.save('source', {**self.rule, 'source_id': 'target'})
        self.a['loader'] = 'paper'; self.store.save_server(self.a)
        with self.assertRaises(Problem): self.manager.syncs.save('target', self.rule)

    def test_runtime_and_mod_registry_follow_source(self):
        (self.src / 'mods').mkdir(); (self.src / 'mods/lib.jar.disabled').write_bytes(b'jar')
        self.a.update(loader_version='0.17.0', mods=[{'path':'mods/lib.jar','project_id':'lib','enabled':False}]);self.store.save_server(self.a)
        def install(sid, mc, lv):
            s=self.store.server(sid);s.update(minecraft=mc,loader_version=lv);self.store.save_server(s)
        with patch.object(self.manager, 'install', side_effect=install) as update:
            result=self.manager.syncs.save('target',{**self.rule,'folders':['mods'],'runtime':True})
            self.assertEqual(result['status'],'Up to date');update.assert_called_once_with('target','1.20.1','0.17.0')
        self.assertEqual(self.store.server('target')['mods'],self.a['mods'])
        self.assertTrue((self.dst/'mods/lib.jar.disabled').exists())

    def test_copy_failure_preserves_destination(self):
        with patch('mmsm.syncs.shutil.copytree',side_effect=OSError('disk full')):
            self.assertIn('disk full',self.manager.syncs.save('target',self.rule)['status'])
        self.assertEqual((self.dst/'config/options.txt').read_text(),'old')


class PortsAndDomains(support.Base):
    def test_duplicate_override_and_listener_claim(self):
        a=support.server(self.store,'first')
        data={'name':'Second','loader':'fabric','minecraft':'1.20.1','loader_version':'0.16.0','port':a['port']}
        with patch.object(self.manager,'job',return_value={}):
            with self.assertRaises(Problem):self.manager.create(data)
            b=self.manager.create({**data,'allow_port_conflict':True})
            with self.assertRaises(Problem):self.manager.create({**data,'port':a['internal_port'],'allow_port_conflict':True})
        self.manager.ensure_proxy(a);self.manager.ensure_proxy(b)
        self.assertEqual(len(self.manager.proxies),1)
        with patch.object(self.manager,'alive',return_value=True):
            with self.assertRaises(Problem):self.manager.ensure_proxy(b,claim=True)
        self.manager.ensure_proxy(b,claim=True)
        self.assertEqual(list(self.manager.proxies),[b['id']])

    def test_domain_records_and_new_install_feed(self):
        self.assertEqual(self.store.settings()['update_feed'],GITHUB_UPDATE_FEED)
        settings={'dns_zone':'example.com','dns_base':'minecraft.example.com','dns_ip':'8.8.8.8'}
        self.store.set_settings(settings);server=support.server(self.store)
        result=save(self.manager,server['id'],{'label':'Survival','port':25570})
        self.assertEqual(result['hostname'],'survival.minecraft.example.com')
        self.assertEqual(result['records'][2]['name'],'_minecraft._tcp.survival.minecraft')
        self.assertEqual(result['srv']['target'],'minecraft.example.com')
        self.assertEqual(result['srv']['port'],25570)
        self.assertTrue(all(x['proxy']=='DNS only' for x in result['records']))
        with self.assertRaises(Problem):validate_settings({**settings,'dns_base':'evil.test'})
        with self.assertRaises(Problem):save(self.manager,server['id'],{'label':'../evil'})


class SyncHTTP(support.HTTPTests):
    test_setup_auth_csrf_roles_and_session_revocation=None
    test_settings_persist_and_static_security_headers=None
    test_login_rate_limit=None
    test_operator_cannot_install_or_modify_files=None
    def test_edit_confirmation_and_scoped_source_access(self):
        self.owner();a=support.server(self.store,'source');b=support.server(self.store,'target')
        (self.manager.folder('source')/'config').mkdir()
        rule={'source_id':'source','folders':['config'],'confirm':True}
        self.assertEqual(self.request('/api/servers/target/syncs','PUT',rule)[0],200)
        code,body,_=self.request('/api/servers/target/files','PUT',{'path':'config/options.txt','content':'test'})
        self.assertEqual(code,409);self.assertIn('SYNC_CONFLICT:',body['error'])
        self.assertEqual(self.request('/api/servers/target/files','PUT',{'path':'config/options.txt','content':'test'},{'X-MMSM-Unlink-Sync':'true'})[0],200)
        self.assertNotIn('sync',self.store.server('target'))
        self.store.add_user('limited','limited-password-123','admin')
        self.store.execute('UPDATE users SET server_ids=? WHERE username=?',(json.dumps(['target']),'limited'))
        _,login,h=self.request('/api/login','POST',{'username':'limited','password':'limited-password-123'})
        self.token=h['Set-Cookie'].split(';')[0];self.csrf=login['csrf']
        self.assertEqual(self.request('/api/servers/target/syncs')[1]['sources'],[])
        self.assertEqual(self.request('/api/servers/target/syncs','PUT',rule)[0],404)
