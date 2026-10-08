from unittest.mock import patch
import test_manager as support
from mmsm.domains import save, publish_all, unm_url, validate_settings
from mmsm.store import Problem

SETTINGS=dict(dns_provider='unm',dns_zone='minecraft.example.com',dns_base='minecraft.example.com',dns_ip='8.8.8.8',dns_auto=True,unm_url='http://127.0.0.1:8790',unm_token='private-unm-token')

class UNMDNS(support.Base):
    def setUp(self):
        super().setUp()
        self.store.set_settings(SETTINGS)
        self.s=support.server(self.store)
        self.calls=[]
        def call(settings,sid,body):
            self.calls.append((sid,body))
            return {'hostname':body['label']+'.'+settings['dns_zone']} if body else {'published':False}
        mock=patch('mmsm.domains.unm_request',side_effect=call)
        mock.start();self.addCleanup(mock.stop)

    def test_publish_rename_port_clear_retry_and_opt_out(self):
        result=save(self.manager,self.s['id'],dict(label='test',port=25565))
        self.assertEqual(result['automation'],'Published to UNM')
        self.assertEqual([r['type'] for r in result['records']],['A','SRV'])
        self.assertEqual(self.calls[-1][1],dict(zone='minecraft.example.com',label='test',port=25565))
        save(self.manager,self.s['id'],dict(label='renamed',port=25566))
        self.assertEqual(self.calls[-1][1]['port'],25566)
        with patch('mmsm.domains.unm_request',side_effect=ValueError('offline')):
            self.assertIn('offline',save(self.manager,self.s['id'],dict(label='renamed',port=25566))['automation'])
        publish_all(self.manager)
        self.assertEqual(self.store.server(self.s['id'])['dns_status'],'Published to UNM')
        save(self.manager,self.s['id'],dict(label='',port=25566))
        self.assertIsNone(self.calls[-1][1])
        self.assertIsNone(self.store.server(self.s['id'])['unm_managed'])
        self.store.set_settings({'dns_auto':False});self.calls.clear()
        publish_all(self.manager);self.assertEqual(self.calls,[])

    def test_wrong_endpoint_and_provider_do_not_abandon_owned_records(self):
        save(self.manager,self.s['id'],dict(label='test'))
        self.store.set_settings({'unm_url':'https://other.example.com'})
        self.calls.clear();publish_all(self.manager)
        self.assertEqual(self.calls,[])
        self.assertIn('previous UNM endpoint',self.store.server(self.s['id'])['dns_status'])

    def test_server_deletion_removes_owned_dns_and_retries_outages(self):
        save(self.manager, self.s['id'], dict(label='test'))
        with patch('mmsm.domains.unm_request', side_effect=ValueError('offline')):
            result = self.manager.delete_server(self.s['id'], self.s['name'])
        self.assertTrue(result['deleted'])
        self.assertIn('DNS cleanup is pending', result['warning'])
        self.assertEqual(len(self.store.rows('SELECT * FROM unm_dns_cleanup')), 1)
        self.store.set_settings({'dns_auto': False})
        publish_all(self.manager)
        self.assertEqual(self.calls[-1], (self.s['id'], None))
        self.assertEqual(self.store.rows('SELECT * FROM unm_dns_cleanup'), [])

    def test_deletion_cleanup_preserves_endpoint_scope(self):
        save(self.manager, self.s['id'], dict(label='test'))
        self.store.set_settings({'unm_url': 'https://other.example.com'})
        self.calls.clear()
        result = self.manager.delete_server(self.s['id'], self.s['name'])
        self.assertIn('pending', result['warning'])
        self.assertEqual(self.calls, [])
        self.store.set_settings({'unm_url': SETTINGS['unm_url']})
        publish_all(self.manager)
        self.assertEqual(self.calls, [(self.s['id'], None)])

    def test_delete_success_and_archive_retains_dns(self):
        save(self.manager, self.s['id'], dict(label='test'))
        server = self.store.server(self.s['id']); server['archived'] = True
        self.store.save_server(server)
        self.calls.clear(); publish_all(self.manager)
        self.assertEqual(self.calls, [])
        result = self.manager.delete_server(self.s['id'], self.s['name'])
        self.assertEqual(result, {'deleted': True})
        self.assertEqual(self.calls, [(self.s['id'], None)])

    def test_validation(self):
        for url in ('http://example.com','https://user:pass@example.com','https://example.com/path','https://example.com?token=secret'):
            with self.assertRaises(Problem):unm_url(url)
        with self.assertRaises(Problem):validate_settings(dict(SETTINGS,dns_zone='example.com'))

class UNMSettings(support.HTTPTests):
    test_setup_auth_csrf_roles_and_session_revocation=None
    test_settings_persist_and_static_security_headers=None
    test_login_rate_limit=None
    test_operator_cannot_install_or_modify_files=None
    def test_token_is_write_only_and_blank_preserves_it(self):
        self.owner()
        self.assertEqual(self.request('/api/settings','PUT',SETTINGS)[0],200)
        result=self.request('/api/settings')[1]
        self.assertNotIn('unm_token',result)
        self.assertTrue(result['unm_token_saved'])
        self.assertEqual(self.request('/api/settings','PUT',{'unm_token':''})[0],200)
        self.assertEqual(self.store.settings()['unm_token'],'private-unm-token')
        self.assertEqual(self.request('/api/settings','PUT',{'unm_token':'bad\nheader'})[0],400)
