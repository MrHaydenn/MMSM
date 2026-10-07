from unittest.mock import patch
import test_manager as support
from mmsm.web_config import startup_network, public_origin
from mmsm.store import Problem

class NetworkSettings(support.HTTPTests):
    test_setup_auth_csrf_roles_and_session_revocation=None
    test_settings_persist_and_static_security_headers=None
    test_login_rate_limit=None
    test_operator_cannot_install_or_modify_files=None
    def test_defaults_accept_public_ip_but_preserve_origin_and_hostname_checks(self):
        self.assertEqual(startup_network(self.store.settings()),('0.0.0.0',None))
        self.assertEqual(self.request('/',headers={'Host':'8.8.8.8:3000'})[0],200)
        self.owner()
        self.assertEqual(self.request('/api/dashboard',headers={'Host':'8.8.8.8:3000','Origin':'http://8.8.8.8:3000'})[0],200)
        self.assertEqual(self.request('/api/dashboard',headers={'Host':'8.8.8.8:3000','Origin':'https://evil.test'})[0],403)
        self.assertEqual(self.request('/',headers={'Host':'evil.test'})[0],403)
        self.assertEqual(self.request('/',headers={'Host':'8.8.8.8:3000','Sec-Fetch-Site':'cross-site'})[0],403)
    def test_saved_origin_startup_overrides_and_secure_proxy_login(self):
        self.owner()
        code,body,_=self.request('/api/settings','PUT',{'bind_host':'0.0.0.0','public_origin':'https://mmsm.example.com/'})
        self.assertEqual(code,200);self.assertTrue(body['restart_required'])
        self.assertEqual(startup_network(self.store.settings()),('0.0.0.0','https://mmsm.example.com'))
        self.assertEqual(startup_network(self.store.settings(),'127.0.0.1',''),('127.0.0.1',None))
        self.web.origin=startup_network(self.store.settings())[1]
        headers={'Host':'mmsm.example.com','Origin':'https://mmsm.example.com'}
        self.assertEqual(self.request('/',headers=headers)[0],200)
        code,_,h=self.request('/api/login','POST',{'username':'owner','password':'correct-horse-battery'},headers)
        self.assertEqual(code,200);self.assertIn('Secure',h['Set-Cookie'])
        self.assertEqual(self.request('/',headers={'Host':'8.8.8.8:3000'})[0],200)
    def test_invalid_network_settings_rejected(self):
        self.owner()
        self.assertEqual(public_origin('https://MMSM.Example.com:443/'),'https://mmsm.example.com')
        for url in ('ftp://example.com','https://example.com/path','https://user:pass@example.com','https://example.com:99999','https://example.com/?x=1'):
            self.assertEqual(self.request('/api/settings','PUT',{'public_origin':url})[0],400)
        self.assertEqual(self.request('/api/settings','PUT',{'bind_host':'anything'})[0],400)
