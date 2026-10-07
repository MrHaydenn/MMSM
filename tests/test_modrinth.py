import hashlib
import json
from pathlib import Path
import zipfile
from unittest.mock import patch

from test_manager import Base, server
from mmsm.store import Problem


class ModrinthTests(Base):
    def artifact(self,name,content=b'jar'):
        return {'filename':name,'url':'https://cdn.modrinth.com/'+name,'hashes':{'sha512':hashlib.sha512(content).hexdigest()},'primary':True}

    def version(self,vid,pid,filename,deps=None):
        return dict(id=vid,project_id=pid,version_number=vid,loaders=['fabric'],game_versions=['1.20.1'],files=[self.artifact(filename)],dependencies=deps or [])

    def fake_download(self,url,dest,*args,**kwargs):
        Path(dest).parent.mkdir(parents=True,exist_ok=True);Path(dest).write_bytes(b'jar');return Path(dest)

    def test_dependencies_install_and_reenable_disabled_dependency(self):
        s=server(self.store);p=self.manager.providers
        main=self.version('v1','main','main.jar',[{'dependency_type':'required','version_id':'v2','project_id':'dep'}])
        dep=self.version('v2','dep','dep.jar')
        versions={'v1':main,'v2':dep}
        with patch.object(p,'mod_version',side_effect=lambda v:versions[v]),patch.object(p,'get',return_value={'title':'Fixture','project_type':'mod','server_side':'required'}),patch.object(p,'download',side_effect=self.fake_download):
            self.manager.install_mods(s['id'],'v2')
            self.manager.toggle_mod(s['id'],'dep',False)
            self.manager.install_mods(s['id'],'v1')
        saved=self.store.server(s['id'])
        self.assertEqual({m['project_id'] for m in saved['mods']},{'main','dep'})
        self.assertEqual(next(m for m in saved['mods'] if m['project_id']=='main')['requires_project_ids'],['dep'])
        self.assertEqual(next(m for m in saved['mods'] if m['project_id']=='dep')['requires_project_ids'],[])
        self.assertTrue(all(m['enabled'] for m in saved['mods']))
        self.assertTrue((self.manager.folder(s['id'])/'mods/dep.jar').exists())
        self.assertFalse((self.manager.folder(s['id'])/'mods/dep.jar.disabled').exists())

    def test_incompatible_or_client_only_mod_rejected_without_mutation(self):
        s=server(self.store);p=self.manager.providers
        v=self.version('v1','main','main.jar');v['game_versions']=['1.19']
        with patch.object(p,'mod_version',return_value=v):
            with self.assertRaises(Problem):self.manager.install_mods(s['id'],'v1')
        v['game_versions']=['1.20.1']
        with patch.object(p,'mod_version',return_value=v),patch.object(p,'get',return_value={'server_side':'unsupported'}):
            with self.assertRaises(Problem):self.manager.install_mods(s['id'],'v1')
        self.assertEqual(self.store.server(s['id'])['mods'],[])

    def test_mod_download_failure_leaves_originals_untouched(self):
        s=server(self.store);p=self.manager.providers
        root=self.manager.folder(s['id']);(root/'mods').mkdir();(root/'mods'/'old.jar').write_bytes(b'old')
        s['mods']=[dict(project_id='main',version_id='old',name='Old',version='old',path='mods/old.jar',enabled=True,update=None)]
        self.store.save_server(s)
        with patch.object(p,'mod_version',return_value=self.version('v1','main','main.jar')),patch.object(p,'get',return_value={'title':'Fixture','project_type':'mod','server_side':'required'}),patch.object(p,'download',side_effect=Problem('download failed')):
            with self.assertRaises(Problem):self.manager.install_mods(s['id'],'v1')
        self.assertEqual((root/'mods'/'old.jar').read_bytes(),b'old')
        self.assertEqual(self.store.server(s['id'])['mods'][0]['version_id'],'old')

    def make_pack(self,path,bad_path=None):
        index={'formatVersion':1,'game':'minecraft','versionId':'packv1','name':'Fixture pack',
               'dependencies':{'minecraft':'1.20.1','fabric-loader':'0.16.0'},'files':[
            {'path':bad_path or 'mods/server.jar','hashes':{'sha512':hashlib.sha512(b'jar').hexdigest()},'downloads':['https://cdn.modrinth.com/server.jar'],'env':{'server':'required'}},
            {'path':'mods/client.jar','hashes':{},'downloads':[],'env':{'server':'unsupported'}}]}
        with zipfile.ZipFile(path,'w') as z:
            z.writestr('modrinth.index.json',json.dumps(index))
            z.writestr('overrides/config/fixture.json','{"layer":"shared"}')
            z.writestr('server-overrides/config/fixture.json','{"layer":"server"}')
            z.writestr('client-overrides/config/client.json','{}')
        return index

    def test_mrpack_server_files_overrides_and_tracking(self):
        s=server(self.store);p=self.manager.providers
        pack=self.store.root/'fixture.mrpack';self.make_pack(pack)
        version=dict(id='packv1',project_id='pack',files=[self.artifact('fixture.mrpack',pack.read_bytes())])
        def download(url,dest,*args,**kwargs):
            if url.endswith('.mrpack'):return pack
            return self.fake_download(url,dest)
        with patch.object(p,'mod_version',return_value=version),patch.object(p,'download',side_effect=download),patch.object(p,'get',return_value={'project_id':'servermod','id':'serverv1','version_number':'1'}):
            self.manager.pack(s['id'],'packv1')
        root=self.manager.folder(s['id'])
        self.assertTrue((root/'mods/server.jar').exists())
        self.assertFalse((root/'mods/client.jar').exists())
        self.assertFalse((root/'config/client.json').exists())
        self.assertEqual(json.loads((root/'config/fixture.json').read_text())['layer'],'server')
        self.assertEqual(self.store.server(s['id'])['mods'][0]['project_id'],'servermod')
        self.assertEqual(self.store.server(s['id'])['modpack']['name'],'Fixture pack')

    def test_mrpack_unsafe_path_rolls_back(self):
        s=server(self.store);p=self.manager.providers
        pack=self.store.root/'fixture.mrpack';self.make_pack(pack,'../escape.jar')
        version=dict(id='packv1',project_id='pack',files=[self.artifact('fixture.mrpack',pack.read_bytes())])
        with patch.object(p,'mod_version',return_value=version),patch.object(p,'download',return_value=pack):
            with self.assertRaises(Problem):self.manager.pack(s['id'],'packv1')
        self.assertFalse((self.store.root/'servers'/s['id']/'escape.jar').exists())
        self.assertFalse(self.store.server(s['id']).get('modpack'))

    def test_paper_accepts_spigot_plugin_and_installs_into_plugins(self):
        s=server(self.store);s['loader']='paper';self.store.save_server(s);p=self.manager.providers
        v=self.version('v1','plugin','plugin.jar');v['loaders']=['spigot']
        with patch.object(p,'mod_version',return_value=v),patch.object(p,'get',return_value={'title':'Plugin fixture','project_type':'mod','server_side':'required'}),patch.object(p,'download',side_effect=self.fake_download):
            self.manager.install_mods(s['id'],'v1')
        self.assertTrue((self.manager.folder(s['id'])/'plugins/plugin.jar').exists())
        self.assertEqual(self.store.server(s['id'])['mods'][0]['path'],'plugins/plugin.jar')

    def test_paper_plugin_search_and_version_filters(self):
        from urllib.parse import urlparse,parse_qs
        p=self.manager.providers;s=server(self.store);s['loader']='paper'
        with patch.object(p,'get',return_value={}) as get:
            p.search('permission','paper','1.20.1','plugin')
            facets=json.loads(parse_qs(urlparse(get.call_args.args[0]).query)['facets'][0])
            self.assertIn(['categories:paper','categories:spigot','categories:bukkit'],facets)
            self.assertIn(['project_type:mod','all_project_types:plugin'],facets)
            p.mod_versions('plugin',s)
            loaders=json.loads(parse_qs(urlparse(get.call_args.args[0]).query)['loaders'][0])
            self.assertEqual(loaders,['paper','spigot','bukkit'])
