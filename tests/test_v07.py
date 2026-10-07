import io, zipfile, json, urllib.request, urllib.error
from unittest.mock import patch
from test_manager import Base, server
import test_v02
from mmsm.store import Problem

class LocalMods(Base):
    def jar(self):
        stream=io.BytesIO()
        with zipfile.ZipFile(stream,'w') as z:z.writestr('META-INF/MANIFEST.MF','Manifest-Version: 1.0\n')
        return stream.getvalue()
    def upload(self,sid,name='custom.jar'):
        data=self.jar();return self.manager.upload_mod(sid,name,io.BytesIO(data),len(data))['mod']
    def test_local_upload_toggle_and_no_modrinth_calls(self):
        s=server(self.store);sid=s['id'];m=self.upload(sid)
        self.assertEqual(m['source'],'local');self.assertIsNone(m['version_id'])
        self.manager.toggle_mod(sid,m['project_id'],False)
        self.assertTrue((self.manager.folder(sid)/'mods/custom.jar.disabled').exists())
        with patch.object(self.manager.providers,'get') as get,patch.object(self.manager.providers,'mod_versions') as versions,patch.object(self.manager.providers,'mod_version') as version:
            self.manager.mod_icons(sid);self.manager.check_updates(sid)
            get.assert_not_called();versions.assert_not_called();version.assert_not_called()
        self.manager.toggle_mod(sid,m['project_id'],True)
        self.assertTrue((self.manager.folder(sid)/'mods/custom.jar').exists())
    def test_invalid_collision_running_archive_and_vanilla(self):
        s=server(self.store);sid=s['id'];self.upload(sid)
        for name in ('custom.jar','CUSTOM.JAR','../evil.jar','evil.txt'):
            with self.assertRaises(Problem):self.upload(sid,name)
        self.manager.toggle_mod(sid,self.store.server(sid)['mods'][0]['project_id'],False)
        with self.assertRaises(Problem):self.upload(sid)
        with self.assertRaises(Problem):self.manager.upload_mod(sid,'bad.jar',io.BytesIO(b'not jar'),7)
        self.assertFalse((self.manager.folder(sid)/'mods/bad.jar').exists())
        with patch.object(self.manager,'alive',return_value=True):
            with self.assertRaises(Problem):self.upload(sid,'other.jar')
        self.manager.archive(sid,True)
        with self.assertRaises(Problem):self.upload(sid,'other.jar')
        self.manager.archive(sid,False);s=self.store.server(sid);s['loader']='vanilla';self.store.save_server(s)
        with self.assertRaises(Problem):self.upload(sid,'other.jar')
    def test_paper_uses_plugins_and_failed_database_changes_restore_files(self):
        s=server(self.store);s['loader']='paper';self.store.save_server(s);sid=s['id'];m=self.upload(sid)
        self.assertEqual(m['path'],'plugins/custom.jar')
        with patch.object(self.store,'save_server',side_effect=RuntimeError('fixture database failure')):
            with self.assertRaises(RuntimeError):self.upload(sid,'second.jar')
            with self.assertRaises(RuntimeError):self.manager.toggle_mod(sid,m['project_id'],False)
        self.assertFalse((self.manager.folder(sid)/'plugins/second.jar').exists())
        self.assertTrue((self.manager.folder(sid)/'plugins/custom.jar').exists())
        self.assertFalse((self.manager.folder(sid)/'plugins/custom.jar.disabled').exists())
        self.assertTrue(self.store.server(sid)['mods'][0]['enabled'])
    def test_required_dependencies_backfill_using_current_installed_version(self):
        s=server(self.store);s['mods']=[{'project_id':'main','version_id':'v1','name':'Main','enabled':True,'icon_url':None}];self.store.save_server(s)
        current={'id':'v1','date_published':'2025-01-01','dependencies':[{'dependency_type':'required','version_id':'dep-version'},{'dependency_type':'optional','project_id':'optional'}]}
        with patch.object(self.manager.providers,'mod_versions',return_value=[]),patch.object(self.manager.providers,'mod_version',side_effect=lambda vid:current if vid=='v1' else {'project_id':'library'}):self.manager.check_updates(s['id'])
        self.assertEqual(self.store.server(s['id'])['mods'][0]['requires_project_ids'],['library'])

class UploadHTTP(test_v02.NewHTTPTests):
    test_upload_auth_csrf_and_delete_routes=None
    test_download_dismissal_persists_per_account_and_keeps_audit_history=None
    test_search_pagination_reaches_provider=None
    test_sleep_and_kill_roles_and_sleep_requires_toggle=None
    def test_mod_upload_http_roles_csrf_and_tracking(self):
        s=server(self.store);sid=s['id'];data=LocalMods.jar(self)
        def send(token=None):
            req=urllib.request.Request(self.base+'/api/servers/'+sid+'/mods-upload?name=local.jar',data=data,headers={'Content-Type':'application/octet-stream','Cookie':self.token or '', 'X-CSRF-Token':token or self.csrf or ''})
            try:r=urllib.request.urlopen(req,timeout=3)
            except urllib.error.HTTPError as e:r=e
            return r.status,json.loads(r.read())
        self.assertEqual(send()[0],401);self.owner();self.assertEqual(send('wrong')[0],403)
        status,result=send();self.assertEqual(status,201);self.assertEqual(result['mod']['source'],'local')
        self.assertEqual(len(self.store.server(sid)['mods']),1)
        self.request('/api/users','POST',dict(username='operator',password='correct-horse-battery',role='operator'))
        _,body,h=self.request('/api/login','POST',dict(username='operator',password='correct-horse-battery'));self.token=h['Set-Cookie'].split(';')[0];self.csrf=body['csrf']
        self.assertEqual(send()[0],403)
