import json
from unittest.mock import patch
import test_manager as support
from mmsm.jvm import effective, normalize, tokens
from mmsm.store import Problem

class JVMOptions(support.Base):
    def test_heap_canonicalization_and_independent_custom_settings(self):
        s=support.server(self.store);sid=s['id']
        result=self.manager.configure(sid,{'memory_mb':2048,'jvm_args':'-Xms256M -Xmx1G -Xmx2G -XX:+UseG1GC "-Dexample=value with spaces"'})
        self.assertEqual(tokens(result['jvm_arguments']),['-Xms256M','-Xmx2048M','-XX:+UseG1GC','-Dexample=value with spaces'])
        saved=self.store.server(sid);self.assertEqual(saved['jvm_args'],['-XX:+UseG1GC','-Dexample=value with spaces'])
        self.manager.configure(sid,{'memory_mb':4096})
        self.assertEqual(effective(self.store.server(sid)),['-Xms256M','-Xmx4096M','-XX:+UseG1GC','-Dexample=value with spaces'])
        self.manager.configure(sid,{'jvm_args':'-Xms128M -Xmx3G -XX:+UseG1GC'})
        self.assertEqual(self.store.server(sid)['memory_mb'],3072)
        self.assertEqual(self.store.server(sid)['initial_memory_mb'],128)
    def test_invalid_or_conflicting_options_do_not_change_settings(self):
        s=support.server(self.store);sid=s['id']
        for value in ('-Xmx2G','-Xms2G','-Xmxwrong','-XX:MaxHeapSize=2G','@custom.txt','-jar other.jar','-cp classes','SomeMain','--add-opens','-Dfoo="unfinished'):
            with self.assertRaises((Problem,ValueError)):self.manager.configure(sid,{'memory_mb':1024,'jvm_args':value})
            self.assertEqual(self.store.server(sid)['memory_mb'],1024)
            self.assertNotIn('jvm_args',self.store.server(sid))
        with patch.object(self.manager,'alive',return_value=True),self.assertRaises(Problem):self.manager.configure(sid,{'jvm_args':'-XX:+UseG1GC'})
    def test_quoted_values_and_legacy_defaults(self):
        s=support.server(self.store)
        self.assertEqual(effective(s),['-Xms512M','-Xmx1024M'])
        args,memory,initial=normalize('--add-opens java.base/java.lang=ALL-UNNAMED "-Dfoo=hello world"',1024)
        self.assertEqual(args,['--add-opens','java.base/java.lang=ALL-UNNAMED','-Dfoo=hello world'])

class JVMAccess(support.HTTPTests):
    test_setup_auth_csrf_roles_and_session_revocation=None
    test_settings_persist_and_static_security_headers=None
    test_login_rate_limit=None
    test_operator_cannot_install_or_modify_files=None
    def test_jvm_editor_uses_settings_permission_and_hides_options_from_other_users(self):
        self.owner();s=support.server(self.store);sid=s['id']
        self.assertEqual(self.request('/api/servers/'+sid+'/configure','PUT',{'memory_mb':2048,'jvm_args':'-Xmx2G -Dexample=custom'})[0],200)
        user=self.store.add_user('Viewer','a','viewer')
        _,login,h=self.request('/api/login','POST',{'username':'Viewer','password':'a'})
        self.token=h['Set-Cookie'].split(';')[0];self.csrf=login['csrf']
        result=self.request('/api/servers/'+sid)[1];self.assertNotIn('jvm_arguments',result);self.assertNotIn('jvm_args',result)
        self.assertEqual(self.request('/api/servers/'+sid+'/configure','PUT',{'jvm_args':'-Dfoo=bar'})[0],403)
        self.store.execute('UPDATE users SET permissions=? WHERE id=?',(json.dumps({'server':{'settings':True}}),user['id']))
        result=self.request('/api/servers/'+sid)[1];self.assertIn('-Dexample=custom',result['jvm_arguments'])
        self.assertEqual(self.request('/api/servers/'+sid+'/configure','PUT',{'jvm_args':'-Xmx3G -Dexample=updated'})[0],200)
        self.assertEqual(self.store.server(sid)['memory_mb'],3072)
