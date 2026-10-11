import hashlib
import time
import test_manager as support

class Launcher(support.HTTPTests):
    test_setup_auth_csrf_roles_and_session_revocation=None
    test_settings_persist_and_static_security_headers=None
    test_login_rate_limit=None
    test_operator_cannot_install_or_modify_files=None

    def connect(self):
        code,pair,_=self.request('/api/launcher/pairings','POST',{})
        self.assertEqual(code,201)
        code,result,headers=self.request('/api/launcher/connect','POST',{'token':pair['token']})
        self.assertEqual(code,200)
        return pair,result,headers

    def test_pairing_is_one_use_and_secrets_are_hashed_and_cookie_matches_account(self):
        self.owner();browser_token=self.token
        self.assertEqual(self.request('/api/launcher/info')[1]['protocol'],1)
        pair,connection,headers=self.connect()
        self.assertEqual(self.request('/api/launcher/connect','POST',{'token':pair['token']})[0],401)
        self.assertFalse(self.store.rows('SELECT * FROM launcher_pairings'))
        row=self.store.rows('SELECT * FROM launcher_connections')[0]
        self.assertEqual(row['token'],hashlib.sha256(connection['access_token'].encode()).hexdigest())
        self.token=headers['Set-Cookie'].split(';')[0]
        me=self.request('/api/me')[1]
        self.assertEqual(me['user']['id'],connection['user']['id'])
        self.assertEqual(self.request('/api/launcher/pairings','POST',{},headers={'X-CSRF-Token':me['csrf']})[0],403)
        self.token=browser_token
        self.assertEqual(self.request('/api/launcher/connections')[1][0]['id'],connection['connection_id'])

    def test_revoke_invalidates_access_and_embedded_sessions(self):
        self.owner();browser_token=self.token
        _,connection,headers=self.connect();embedded=headers['Set-Cookie'].split(';')[0]
        bearer={'Authorization':'Bearer '+connection['access_token']}
        self.assertEqual(self.request('/api/launcher/connections/'+connection['connection_id'],'DELETE',{})[0],200)
        self.assertEqual(self.request('/api/launcher/session','POST',{},headers=bearer)[0],401)
        self.token=embedded
        self.assertEqual(self.request('/api/me')[0],401)
        self.token=browser_token;self.assertEqual(self.request('/api/me')[0],200)

    def test_expiry_csrf_and_password_change_revoke_pairings_and_connections(self):
        self.owner();csrf=self.csrf;self.csrf=None
        self.assertEqual(self.request('/api/launcher/pairings','POST',{})[0],403)
        self.csrf=csrf
        _,pair,_=self.request('/api/launcher/pairings','POST',{})
        self.store.execute('UPDATE launcher_pairings SET expires=?',(time.time()-1,))
        self.assertEqual(self.request('/api/launcher/connect','POST',{'token':pair['token']})[0],401)
        _,connection,_=self.connect()
        self.assertEqual(self.request('/api/password','POST',{'current':'correct-horse-battery','password':'changed'})[0],200)
        self.assertEqual(self.request('/api/launcher/session','POST',{},headers={'Authorization':'Bearer '+connection['access_token']})[0],401)
        self.assertFalse(self.store.rows('SELECT * FROM launcher_pairings'))

    def test_launcher_keeps_viewer_permissions_and_cannot_revoke_other_accounts(self):
        self.owner();_,owner_connection,_=self.connect()
        viewer=self.store.add_user('DemoViewer','password','viewer')
        self.store.execute('UPDATE users SET server_ids=? WHERE id=?',('[]',viewer['id']))
        _,login,headers=self.request('/api/login','POST',{'username':'demoviewer','password':'password'})
        self.token=headers['Set-Cookie'].split(';')[0];self.csrf=login['csrf']
        self.assertEqual(self.request('/api/launcher/connections/'+owner_connection['connection_id'],'DELETE',{})[0],404)
        _,connection,headers=self.connect()
        self.token=headers['Set-Cookie'].split(';')[0];self.csrf=self.request('/api/me')[1]['csrf']
        self.assertEqual(connection['user']['username'],'DemoViewer')
        self.assertEqual(self.request('/api/servers')[1],[])
        self.assertEqual(self.request('/api/settings')[0],403)
