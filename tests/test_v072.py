import hashlib
from mmsm.store import Store
import test_manager as support

class Accounts(support.HTTPTests):
    test_setup_auth_csrf_roles_and_session_revocation=None
    test_settings_persist_and_static_security_headers=None
    test_login_rate_limit=None
    test_operator_cannot_install_or_modify_files=None
    def login_as(self,headers,password='correct-horse-battery'):
        code,body,h=self.request('/api/login','POST',{'username':'owner','password':password},headers)
        self.assertEqual(code,200,body)
        self.token=h['Set-Cookie'].split(';')[0];self.csrf=body['csrf']
        return h['Set-Cookie']
    def test_http_ip_accounts_with_https_public_url_configured(self):
        self.owner();self.web.origin='https://mmsm.example.com'
        headers={'Host':'8.8.8.8:11015','Origin':'http://8.8.8.8:11015'}
        cookie=self.login_as(headers)
        self.assertIn('mmsm_session_http=',cookie);self.assertNotIn('; Secure',cookie)
        self.assertEqual(self.request('/api/me',headers={'Host':'8.8.8.8:11015'})[0],200)
        code,body,_=self.request('/api/password','POST',{'current':'correct-horse-battery','password':'a-new-password-1234'},headers)
        self.assertEqual(code,200,body)
        self.assertEqual(self.request('/api/me',headers={'Host':'8.8.8.8:11015'})[0],401)
        self.assertEqual(self.request('/api/login','POST',{'username':'owner','password':'correct-horse-battery'},headers)[0],401)
        self.login_as(headers,'a-new-password-1234')
        code,_,h=self.request('/api/logout','POST',{},headers)
        self.assertEqual(code,200);self.assertIn('mmsm_session_http=;',h['Set-Cookie']);self.assertIn('Max-Age=0',h['Set-Cookie'])
        self.assertEqual(self.request('/api/me',headers={'Host':'8.8.8.8:11015'})[0],401)
    def test_local_login_and_https_logout_do_not_conflict(self):
        self.owner();self.web.origin='https://mmsm.example.com'
        local={'Host':'localhost:11015','Origin':'http://localhost:11015'}
        self.assertNotIn('; Secure',self.login_as(local))
        self.assertEqual(self.request('/api/logout','POST',{},local)[0],200)
        remote={'Host':'mmsm.example.com','Origin':'https://mmsm.example.com:443'}
        self.assertIn('; Secure',self.login_as(remote))
        self.assertEqual(self.request('/api/logout','POST',{},remote)[0],200)
        self.assertEqual(self.request('/api/me',headers={'Host':'mmsm.example.com'})[0],401)
    def test_origins_and_csrf_are_still_enforced(self):
        self.owner();self.web.origin='https://mmsm.example.com'
        for origin in ('https://evil.test','http://8.8.8.8:3000','null'):
            self.assertEqual(self.request('/api/logout','POST',{}, {'Host':'8.8.8.8:11015','Origin':origin})[0],403)
        self.assertEqual(self.request('/api/logout','POST',{}, {'Host':'8.8.8.8:11015','Origin':'http://8.8.8.8:11015','X-CSRF-Token':'wrong'})[0],403)
        self.assertEqual(self.request('/api/login','POST',{'username':'owner','password':'correct-horse-battery'},{'Host':'evil.test','Origin':'http://evil.test'})[0],403)
    def test_cookie_selection_skips_stale_legacy_cookie(self):
        self.owner();valid=self.token
        self.token='mmsm_session=expired; '+valid
        self.assertEqual(self.request('/api/me')[0],200)
        self.assertEqual(self.request('/api/logout','POST',{})[0],200)

class DefaultPort(support.Base):
    def test_default_and_one_time_migration_preserve_later_choices(self):
        self.assertEqual(self.store.settings()['web_port'],11015)
        self.store.set_settings({'web_port':3000})
        self.store.execute("DELETE FROM settings WHERE key='_port_11015_migrated'")
        reopened=Store(self.store.root)
        self.assertEqual(reopened.settings()['web_port'],11015)
        reopened.set_settings({'web_port':3000});reopened.db.close()
        again=Store(self.store.root)
        self.assertEqual(again.settings()['web_port'],3000);again.db.close()
    def test_custom_port_is_preserved(self):
        self.store.set_settings({'web_port':9001});self.store.execute("DELETE FROM settings WHERE key='_port_11015_migrated'")
        reopened=Store(self.store.root)
        self.assertEqual(reopened.settings()['web_port'],9001);reopened.db.close()
