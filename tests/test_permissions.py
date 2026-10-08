import json
from unittest.mock import patch
import urllib.request
import urllib.error
import test_manager as support
from mmsm.permissions import CAPABILITIES, capabilities

class AccountPermissions(support.HTTPTests):
    test_setup_auth_csrf_roles_and_session_revocation=None
    test_settings_persist_and_static_security_headers=None
    test_login_rate_limit=None
    test_operator_cannot_install_or_modify_files=None
    def setUp(self):
        super().setUp();self.owner();self.owner_token=self.token;self.owner_csrf=self.csrf
        self.a=support.server(self.store,'existing');self.b=support.server(self.store,'private')
    def account(self, policy, ids=None):
        user=self.store.add_user('Builder','correct-horse-battery','viewer')
        self.store.execute('UPDATE users SET permissions=?,server_ids=? WHERE id=?',(json.dumps(policy),json.dumps(ids or []),user['id']))
        self.login('builder');return user
    def login(self,name):
        _,body,headers=self.request('/api/login','POST',{'username':name,'password':'correct-horse-battery'})
        self.token=headers['Set-Cookie'].split(';')[0];self.csrf=body['csrf']
    def test_creator_gets_ownership_visibility_and_full_control_only_of_own_servers(self):
        user=self.account({'create_servers':True,'server':dict.fromkeys(CAPABILITIES,False)})
        defaults=self.request('/api/creation-defaults')[1];self.assertIn('default_loader',defaults);self.assertNotIn('dns_token',defaults)
        self.assertEqual(self.request('/api/settings')[0],403)
        with patch.object(self.manager,'job',return_value={'queued':True}):
            code,s,_=self.request('/api/servers','POST',dict(name='Mine',loader='fabric',minecraft='1.20.1',loader_version='0.16',port=support.port(),created_by=self.store.rows("SELECT id FROM users WHERE role='owner'")[0]['id']))
        self.assertEqual(code,201);sid=s['id'];self.assertEqual(s['created_by'],user['id']);self.assertTrue(all(s['permissions'].values()))
        self.assertEqual([x['id'] for x in self.request('/api/servers')[1]],[sid])
        self.assertEqual([x['id'] for x in self.request('/api/dashboard')[1]['servers']],[sid])
        self.assertEqual(self.request('/api/servers/'+sid+'/logs')[0],200)
        with patch.object(self.manager,'start',return_value={'queued':True}) as start:
            self.assertEqual(self.request('/api/servers/'+sid+'/start','POST',{})[0],200);start.assert_called_once_with(sid)
        self.assertEqual(self.request('/api/servers/private/logs')[0],404)
        self.store.execute('UPDATE users SET permissions=? WHERE id=?',(json.dumps({'create_servers':False}),user['id']))
        self.assertEqual(self.request('/api/creation-defaults')[0],403)
        self.assertEqual(self.request('/api/servers/'+sid+'/logs')[0],200)
    def test_read_and_write_are_separate_and_override_is_per_server(self):
        false=dict.fromkeys(CAPABILITIES,False)
        self.account({'server':false,'overrides':{'existing':{'console':True,'files':True,'properties':True,'backups':True}}},['existing','private'])
        self.assertEqual(self.request('/api/servers/existing/logs')[0],200)
        self.assertEqual(self.request('/api/servers/existing/files')[0],200)
        self.assertEqual(self.request('/api/servers/existing/properties')[0],200)
        self.assertEqual(self.request('/api/servers/existing/backups')[0],200)
        for path,method,data in [('logs','GET',None),('command','POST',{'command':'op Other'}),('start','POST',{}),('configure','PUT',{'memory_mb':2048}),('backups','POST',{}),('properties','PUT',{'values':{'motd':'changed'}}),('files','DELETE',{'path':'file.txt'}),('players','POST',{'name':'Other','action':'op'}),('project-install','POST',{})]:
            target='private' if path=='logs' else 'existing'
            self.assertEqual(self.request('/api/servers/'+target+'/'+path,method,data)[0],403,(path,method))
        self.assertEqual(self.request('/api/servers/existing/history')[0],403)
        self.assertEqual(self.request('/api/analytics')[1]['servers'],[])
        self.assertEqual(self.request('/api/servers','POST',{})[0],403)
    def test_edit_permission_works_for_viewer_but_raw_upload_is_also_enforced(self):
        self.account({'server':{'files':True,'edit_files':True,'properties':True,'edit_properties':True}},['existing'])
        with patch.object(self.manager,'write_file',return_value={'saved':True}) as write:
            self.assertEqual(self.request('/api/servers/existing/files','PUT',{'path':'config.txt','content':'new'})[0],200);write.assert_called_once()
        req=urllib.request.Request(self.base+'/api/servers/private/upload?path=a.txt',data=b'payload',headers={'Content-Type':'application/octet-stream','Cookie':self.token,'X-CSRF-Token':self.csrf})
        with self.assertRaises(urllib.error.HTTPError) as error:urllib.request.urlopen(req,timeout=4)
        self.assertEqual(error.exception.code,404)
    def test_global_policy_changes_validation_and_session_revocation(self):
        code,user,_=self.request('/api/users','POST',{'username':'NewUser','password':'correct-horse-battery','role':'viewer','server_ids':['existing'],'permissions':{'create_servers':True,'server':{'console':True},'overrides':{}}})
        self.assertEqual(code,201);self.login('newuser')
        self.assertTrue(self.request('/api/me')[1]['user']['permissions']['create_servers'])
        prior_token,prior_csrf=self.token,self.csrf
        self.token=self.owner_token;self.csrf=self.owner_csrf
        self.assertEqual(self.request('/api/users/'+user['id'],'PUT',{'permissions':{'server':{'unknown':True}}})[0],400)
        self.assertEqual(self.request('/api/users/'+user['id'],'PUT',{'permissions':{'create_servers':False,'server':{'console':False}}})[0],200)
        self.token,self.csrf=prior_token,prior_csrf
        self.assertEqual(self.request('/api/me')[0],401)
        self.login('newuser');self.assertEqual(self.request('/api/servers/existing/logs')[0],403)
    def test_backups_do_not_bypass_power_or_host_path_permissions(self):
        self.account({'server':{'backups':True,'manage_backups':True,'power':False}},['existing'])
        for data in ({'schedules':[{'action':'start'}]},{'backup_rules':[{'name':'Unsafe','path':'/tmp/outside','keep':3}]}):
            self.assertEqual(self.request('/api/servers/existing/backups','PUT',data)[0],403)
        self.assertEqual(self.request('/api/servers/existing/backups','PUT',{'backup_rules':[{'name':'Safe','path':'','keep':3}],'schedules':[]})[0],200)
        with patch.object(self.manager,'queue_backup',return_value={'queued':True}):
            self.assertEqual(self.request('/api/servers/existing/backups','POST',{})[0],200)

    def test_console_command_settings_and_raw_upload_check_capabilities_not_role(self):
        user=self.account({'server':{'console':False,'commands':True,'settings':True,'edit_files':False}},['existing'])
        with patch.object(self.manager,'command',return_value={'sent':True}) as command:
            self.assertEqual(self.request('/api/servers/existing/command','POST',{'command':'list'})[0],200);command.assert_called_once()
        with patch.object(self.manager,'configure',return_value={'saved':True}):
            self.assertEqual(self.request('/api/servers/existing/configure','PUT',{'name':'changed'})[0],200)
        self.assertEqual(self.request('/api/servers/existing/logs')[0],403)
        def upload():
            req=urllib.request.Request(self.base+'/api/servers/existing/upload?path=a.txt',data=b'payload',headers={'Content-Type':'application/octet-stream','Cookie':self.token,'X-CSRF-Token':self.csrf})
            try:response=urllib.request.urlopen(req,timeout=4)
            except urllib.error.HTTPError as error:response=error
            return response.status
        self.assertEqual(upload(),403)
        self.store.execute('UPDATE users SET permissions=? WHERE id=?',(json.dumps({'server':{'edit_files':True}}),user['id']))
        with patch.object(self.manager,'upload_file',return_value={'saved':True}) as write:
            self.assertEqual(upload(),201);write.assert_called_once()

    def test_templates_require_full_source_control(self):
        user=self.account({'create_servers':True},['existing'])
        with patch.object(self.manager,'create',return_value={'id':'new-server'}) as create:
            self.assertEqual(self.request('/api/servers','POST',{'source_id':'private'})[0],404)
            self.assertEqual(self.request('/api/servers','POST',{'source_id':'existing'})[0],403)
            create.assert_not_called()
            self.a['created_by']=user['id'];self.store.save_server(self.a)
            self.assertEqual(self.request('/api/servers','POST',{'source_id':'existing'})[0],201)
            self.assertEqual(create.call_args.args[0]['created_by'],user['id'])

    def test_sync_sources_and_global_dns_require_permission(self):
        self.account({'server':{'sync':True}},['existing'])
        code,body,_=self.request('/api/servers/existing/syncs')
        self.assertEqual(code,200);self.assertEqual(body['sources'],[])
        self.assertEqual(self.request('/api/unm-connection')[0],403)
