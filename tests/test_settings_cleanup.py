from unittest.mock import patch
import test_manager as support
from mmsm.network import status
from mmsm.store import password_hash, password_matches, Problem

class Modes(support.Base):
    def test_modes_persist_and_status_and_join_behave_correctly(self):
        s=support.server(self.store,sleep=True);sid=s['id'];s['launch']={'java_major':17};self.store.save_server(s)
        self.manager.configure(sid,{'wake_mode':'join'})
        self.manager.sleep_now(sid);jobs=[]
        with patch.object(self.manager,'spawn_job',side_effect=jobs.append):
            self.assertIn('Join the server',status(s['port'])['description']['text']);self.assertEqual(jobs,[])
            self.assertIn('try joining again',support.join_request(s['port']));self.assertEqual(len(jobs),1)
        self.manager.set_state(sid,status='sleeping')
        self.manager.configure(sid,{'wake_mode':'ping'})
        with patch.object(self.manager,'spawn_job',side_effect=jobs.append):
            self.assertIn('try joining again',status(s['port'])['description']['text']);self.assertEqual(len(jobs),2)
        self.assertEqual(self.store.server(sid)['wake_mode'],'ping')
        self.assertEqual(self.store.server(sid)['wake_history'][0]['reason'],'Minecraft server-list ping')
        self.manager.set_state(sid,status='sleeping')
        with self.assertRaises(Problem):self.manager.configure(sid,{'wake_mode':'invalid'})
    def test_short_passwords_have_no_length_minimum(self):
        stored=password_hash('a');self.assertTrue(password_matches('a',stored));self.assertFalse(password_matches('b',stored))
        with self.assertRaises(Problem):password_hash('')

class Access(support.HTTPTests):
    test_setup_auth_csrf_roles_and_session_revocation=None
    test_settings_persist_and_static_security_headers=None
    test_login_rate_limit=None
    test_operator_cannot_install_or_modify_files=None
    def test_only_owner_manages_users_and_short_password_login(self):
        self.owner();owner_token=self.token;owner_csrf=self.csrf
        self.assertEqual(self.request('/api/users','POST',{'username':'Admin','password':'a','role':'admin'})[0],201)
        viewer=self.request('/api/users','POST',{'username':'Viewer','password':'b','role':'viewer'})[1]
        _,login,h=self.request('/api/login','POST',{'username':'Admin','password':'a'})
        self.token=h['Set-Cookie'].split(';')[0];self.csrf=login['csrf']
        self.assertEqual(self.request('/api/users')[0],403)
        self.assertEqual(self.request('/api/users','POST',{'username':'Another','password':'a','role':'viewer'})[0],403)
        self.assertEqual(self.request('/api/users/'+viewer['id'],'PUT',{'role':'admin'})[0],403)
        self.assertEqual(self.request('/api/users/'+viewer['id'],'DELETE',{})[0],403)
        self.assertEqual(self.request('/api/password','POST',{'current':'a','password':'c'})[0],200)
        self.assertEqual(self.request('/api/login','POST',{'username':'Admin','password':'c'})[0],200)
        self.token=owner_token;self.csrf=owner_csrf
        self.assertEqual(self.request('/api/users')[0],200)
    def test_logo_reset_restores_default_and_requires_admin(self):
        self.owner();path=self.store.root/'images'/'logo.png';path.parent.mkdir();path.write_bytes(b'custom')
        self.assertTrue(self.request('/api/appearance')[1]['logo'])
        self.assertEqual(self.request('/api/assets/logo','DELETE',{})[0],200)
        self.assertFalse(self.request('/api/appearance')[1]['logo']);self.assertFalse(path.exists())
        self.store.add_user('Viewer','a','viewer')
        _,login,h=self.request('/api/login','POST',{'username':'Viewer','password':'a'})
        self.token=h['Set-Cookie'].split(';')[0];self.csrf=login['csrf']
        self.assertEqual(self.request('/api/assets/logo','DELETE',{})[0],403)
