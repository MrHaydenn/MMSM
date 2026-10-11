from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit
import test_manager as support
from mmsm.domains import save, publish, publish_all
from mmsm.store import Problem

SETTINGS = dict(dns_zone='example.com', dns_base='minecraft.example.com', dns_ip='8.8.8.8', dns_auto=True, dns_zone_id='a'*32, dns_token='private-token')

class DNS(support.Base):
    def setUp(self):
        super().setUp(); self.store.set_settings(SETTINGS); self.s=support.server(self.store)
        self.rows={}; self.calls=[]
        self.mock=patch('mmsm.domains.cloudflare',side_effect=self.cf);self.mock.start();self.addCleanup(self.mock.stop)
    def cf(self, settings, method, suffix, body=None):
        self.calls.append((method,suffix,body))
        if suffix=='':return {'name':'example.com'}
        if method=='GET':
            name=parse_qs(urlsplit(suffix).query)['name'][0]
            return [r.copy() for r in self.rows.values() if r['name']==name]
        if method=='DELETE':return self.rows.pop(suffix.split('/')[-1])
        rid=suffix.split('/')[-1] if method=='PUT' else str(len(self.calls))
        self.rows[rid]={'id':rid,**body};return self.rows[rid].copy()
    def test_create_reconcile_change_port_rename_and_clear(self):
        result=save(self.manager,self.s['id'],{'label':'survival','port':25570})
        self.assertEqual(result['automation'],'Published to Cloudflare');self.assertEqual(len(self.rows),3)
        self.assertFalse(any(r.get('proxied') for r in self.rows.values()))
        self.calls.clear();publish(self.manager,self.s['id'])
        self.assertTrue(all(c[0]=='GET' for c in self.calls))
        save(self.manager,self.s['id'],{'label':'survival','port':25571})
        self.assertIn('0 5 25571 minecraft.example.com',[r['content'] for r in self.rows.values()])
        save(self.manager,self.s['id'],{'label':'second','port':25572})
        self.assertEqual(len(self.rows),3);self.assertFalse(any('survival' in r['name'] for r in self.rows.values()))
        save(self.manager,self.s['id'],{'label':''})
        self.assertEqual(len(self.rows),1);self.assertEqual(next(iter(self.rows.values()))['type'],'A')
    def test_existing_records_not_overwritten_failure_retries(self):
        self.rows['other']={'id':'other','name':'minecraft.example.com','type':'A','content':'1.1.1.1'}
        result=save(self.manager,self.s['id'],{'label':'survival'})
        self.assertIn('DNS conflict',result['automation']);self.assertEqual(self.rows['other']['content'],'1.1.1.1')
        self.rows.clear();publish_all(self.manager)
        self.assertEqual(self.store.server(self.s['id'])['dns_status'],'Published to Cloudflare')
        self.store.set_settings({'dns_auto':False});self.calls.clear();publish_all(self.manager);self.assertEqual(self.calls,[])
    def test_wrong_zone_and_archived_never_write(self):
        with patch('mmsm.domains.cloudflare',return_value={'name':'other.com'}) as call:
            result=save(self.manager,self.s['id'],{'label':'survival'})
            self.assertIn('does not match',result['automation']);self.assertEqual(call.call_count,1)
        self.s=self.store.server(self.s['id']);self.s['archived']=True;self.store.save_server(self.s)
        self.calls.clear();publish_all(self.manager);self.assertEqual(self.calls,[])
    def test_creation_address_validation_before_server_created(self):
        data=dict(name='New',loader='fabric',minecraft='1.20.1',loader_version='0.16',port=support.port(),address_label='../bad')
        with patch.object(self.manager,'job'):
            with self.assertRaises(Problem):self.manager.create(data)
            self.assertEqual(len(self.store.servers()),1)
            created=self.manager.create({**data,'address_label':'new','external_port':'25580'})
            self.assertEqual(created['public_hostname'],'new.minecraft.example.com')
            self.assertEqual(created['public_address']['port'],25580)

class DNSHTTP(support.HTTPTests):
    test_setup_auth_csrf_roles_and_session_revocation=None
    test_settings_persist_and_static_security_headers=None
    test_login_rate_limit=None
    test_operator_cannot_install_or_modify_files=None
    def test_token_write_only_keep_blank_and_automation_validation(self):
        self.owner()
        self.assertEqual(self.request('/api/settings','PUT',SETTINGS)[0],200)
        result=self.request('/api/settings')[1]
        self.assertNotIn('dns_token',result);self.assertTrue(result['dns_token_saved'])
        self.assertEqual(self.request('/api/settings','PUT',{'dns_token':''})[0],200)
        self.assertEqual(self.store.settings()['dns_token'],'private-token')
        self.assertEqual(self.request('/api/settings','PUT',{'dns_zone_id':'bad'})[0],400)
    def test_automation_requires_complete_settings_and_valid_zone_type(self):
        self.owner()
        self.assertEqual(self.request('/api/settings','PUT',{'dns_auto':True,'dns_zone_id':'a'*32,'dns_token':'private'})[0],400)
        self.assertEqual(self.request('/api/settings','PUT',{'dns_auto':True,'dns_zone_id':23,'dns_token':'private'})[0],400)
