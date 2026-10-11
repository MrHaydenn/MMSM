import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from mmsm.store import Store, Problem
from mmsm.central_identity import provision
from mmsm.configure_accounts import replace_accounts

class SharedAccounts(unittest.TestCase):
    def test_replace_backup_and_provision_permissions(self):
        with tempfile.TemporaryDirectory() as directory:
            store=Store(Path(directory))
            try:
                old=store.add_user('Previous','old-password','owner',first=True)
                store.login('Previous','old-password')
                identity={'id':'central-owner','username':'SharedOwner','admin':True,'memberships':['mmsm'],'version':1}
                cfg={'url':'https://accounts.mrhaydenn.us','client_id':'mmsm','key':'test-key'}
                backup=replace_accounts(store,cfg,identity)
                self.assertTrue(backup.exists())
                self.assertEqual(store.rows('SELECT id,role FROM users'),[{'id':'central-owner','role':'owner'}])
                self.assertEqual(store.rows('SELECT * FROM sessions'),[])
                with patch('mmsm.central_identity.authenticate',return_value=identity):
                    user,token,csrf=store.login('SharedOwner','secret')
                self.assertEqual(user['role'],'owner')
                with patch('mmsm.central_identity.request',side_effect=Problem('revoked',401)):
                    with self.assertRaises(Problem):store.session(token)
                member={'id':'new-member','username':'SharedMember','version':1}
                provision(store,member)
                provision(store,member)
                row=store.rows('SELECT role,server_ids,password FROM users WHERE id=?',('new-member',))[0]
                self.assertEqual(row['role'],'viewer');self.assertEqual(json.loads(row['server_ids']),[])
                self.assertEqual(row['password'],'central-identity-only')
                with self.assertRaises(Problem):store.add_user('Local','password','admin')
            finally:store.db.close()

    def test_nonadministrator_cannot_replace_local_owner(self):
        with tempfile.TemporaryDirectory() as directory:
            store=Store(Path(directory))
            try:
                store.add_user('Previous','old-password','owner',first=True)
                with self.assertRaises(Problem):replace_accounts(store,{}, {'admin':False})
                self.assertEqual(store.rows('SELECT username FROM users')[0]['username'],'Previous')
                self.assertFalse((store.root/'account-service.json').exists())
            finally:store.db.close()


from test_manager import HTTPTests

class GuidedSetupHTTP(HTTPTests):
    def test_guided_setup_verifies_local_owner_and_shared_admin_before_replacement(self):
        self.owner()
        body={'owner_username':'owner','owner_password':'bad','username':'SharedOwner','password':'shared-password','confirm':True}
        with patch('mmsm.central_identity.request') as remote:
            self.assertEqual(self.request('/api/account-service/setup','POST',body)[0],403)
            remote.assert_not_called()
        body['owner_password']='correct-horse-battery'
        with patch('mmsm.central_identity.request',side_effect=Problem('offline',503)):
            self.assertEqual(self.request('/api/account-service/setup','POST',body)[0],503)
        self.assertEqual(self.store.rows('SELECT username FROM users')[0]['username'],'owner')
        identity={'id':'shared-owner','username':'SharedOwner','admin':True,'memberships':['mmsm']}
        with patch('mmsm.central_identity.request',side_effect=[{'token':'temporary-management-token'},{'key':'dedicated-mmsm-key','user':identity},{'ok':True}]):
            code,result,headers=self.request('/api/account-service/setup','POST',body)
        self.assertEqual(code,200);self.assertNotIn('key',result)
        saved=json.loads((self.store.root/'account-service.json').read_text())
        self.assertEqual(saved['key'],'dedicated-mmsm-key')
        self.assertNotIn('temporary-management-token',json.dumps(saved))
        self.assertEqual(self.store.rows('SELECT id,role FROM users'),[{'id':'shared-owner','role':'owner'}])
        self.assertEqual(self.request('/api/account-service/setup','POST',body)[0],409)


    def test_fresh_guided_setup_requires_terminal_token(self):
        body={'username':'SharedOwner','password':'shared-password','confirm':True,'token':'wrong'}
        with patch('mmsm.central_identity.request') as remote:
            self.assertEqual(self.request('/api/account-service/setup','POST',body)[0],403)
            remote.assert_not_called()
        self.assertFalse((self.store.root/'account-service.json').exists())
