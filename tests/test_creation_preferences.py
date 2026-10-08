from unittest.mock import patch
import test_manager as support
from mmsm.store import Problem

class Creation(support.Base):
    def test_auto_ports_reserve_archived_and_internal_ports_and_exhaustion(self):
        template = support.server(self.store)
        low = support.port()
        self.store.set_settings({'default_port_min': low, 'default_port_max': low})
        data = dict(name='New',loader='vanilla',minecraft='1.20.1')
        with patch.object(self.manager, 'job'):
            created = self.manager.create(data)
        self.assertEqual(created['port'], low)
        with patch.object(self.manager, 'job'), self.assertRaises(Problem):
            self.manager.create(dict(data,name='Another'))

    def test_copy_uses_source_runtime_mods_properties_and_unique_ports(self):
        source = support.server(self.store)
        root = self.manager.folder(source['id'])
        (root/'mods').mkdir(); (root/'mods'/'sample.jar').write_bytes(b'fixture')
        self.manager.write_properties(source, {'motd': 'Copied settings'})
        with patch.object(self.manager, 'install'), patch.object(self.manager, 'job', side_effect=lambda sid,label,fn: fn()):
            created = self.manager.create(dict(name='Copied',source_id=source['id'],source_mode='copy'))
        saved = self.store.server(created['id'])
        self.assertEqual(saved['loader_version'], source['loader_version'])
        self.assertEqual((self.manager.folder(created['id'])/'mods'/'sample.jar').read_bytes(), b'fixture')
        self.assertEqual(self.manager.properties(created['id'])['motd'], 'Copied settings')
        self.assertNotEqual(saved['port'], source['port'])
        self.assertNotEqual(saved['internal_port'], source['internal_port'])
        self.assertNotIn('sync', saved)

    def test_creation_can_keep_source_synced(self):
        source = support.server(self.store)
        with patch.object(self.manager, 'install'), patch.object(self.manager, 'job', side_effect=lambda sid,label,fn: fn()):
            created = self.manager.create(dict(name='Synced',source_id=source['id'],source_mode='sync'))
        self.assertNotIn('settings',self.store.server(created['id'])['sync'])
        self.assertTrue(self.store.server(created['id'])['sync']['runtime'])
        source['memory_mb'] = 4096
        self.store.save_server(source)
        self.manager.write_properties(source, {'motd': 'Synced properties'})
        self.manager.syncs.run(created['id'])
        self.assertEqual(self.store.server(created['id'])['memory_mb'], created['memory_mb'])
        self.assertNotEqual(self.manager.properties(created['id']).get('motd'), 'Synced properties')

class Username(support.HTTPTests):
    test_setup_auth_csrf_roles_and_session_revocation=None
    test_settings_persist_and_static_security_headers=None
    test_login_rate_limit=None
    test_operator_cannot_install_or_modify_files=None
    def test_own_username_requires_password_preserves_role_and_case_insensitive_login(self):
        self.owner()
        self.assertEqual(self.request('/api/username','POST',{'username':'NewOwner','current':'wrong'})[0],403)
        self.assertEqual(self.request('/api/username','POST',{'username':'NewOwner','current':'correct-horse-battery'})[0],200)
        me=self.request('/api/me')[1]['user']
        self.assertEqual(me['username'], 'NewOwner')
        self.assertEqual(me['role'], 'owner')
        self.assertEqual(self.store.login('newowner','correct-horse-battery')[0]['id'], me['id'])

