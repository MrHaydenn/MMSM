import hashlib
import io
import json
from pathlib import Path
import subprocess
import sys
import urllib.request
import zipfile
from unittest.mock import patch
import test_manager as support
from mmsm import __version__
from mmsm.store import GITHUB_EXPERIMENTAL_FEED, Problem

class Channels(support.Base):
    def manifest(self, **values):
        return {'version':__version__,'url':'https://example.com/build.zip','sha256':'a'*64,'channel':'experimental','revision':'a'*40,**values}
    def check(self, manifest, **installed):
        with patch('mmsm.updater.fetch',return_value=json.dumps(manifest).encode()) as fetch, patch.multiple('mmsm.updater',**({'__revision__':'','__build_channel__':'stable',**installed})):
            state=self.manager.updater.check()
        return state,fetch
    def test_experimental_uses_commit_identity_and_official_feed(self):
        self.store.set_settings({'update_channel':'experimental','update_feed':'https://custom.example/latest.json'})
        state,fetch=self.check(self.manifest(),__revision__='b'*40,__build_channel__='experimental')
        self.assertEqual(state['status'],'available');self.assertEqual(state['revision'],'a'*40)
        fetch.assert_called_once_with(GITHUB_EXPERIMENTAL_FEED,256*1024)
        state,_=self.check(self.manifest(),__revision__='a'*40,__build_channel__='experimental')
        self.assertEqual(state['status'],'current')
        self.check(self.manifest(),__revision__='b'*40,__build_channel__='experimental')
        self.assertEqual(len(self.store.rows("SELECT * FROM notifications WHERE kind='wrapper'")),1)
    def test_channel_switch_and_return_to_stable_same_version(self):
        self.store.set_settings({'update_channel':'experimental'})
        state,_=self.check(self.manifest(),__revision__='a'*40,__build_channel__='stable')
        self.assertEqual(state['status'],'available')
        self.store.set_settings({'update_channel':'stable'})
        stable=self.manifest(channel='stable')
        state,_=self.check(stable,__revision__='a'*40,__build_channel__='experimental')
        self.assertEqual(state['status'],'available')
        state,_=self.check(stable,__revision__='a'*40,__build_channel__='stable')
        self.assertEqual(state['status'],'current')
    def test_invalid_experimental_manifest_rejected(self):
        self.store.set_settings({'update_channel':'experimental'})
        for manifest in (self.manifest(revision='bad'),self.manifest(channel='stable')):
            self.assertEqual(self.check(manifest)[0]['status'],'failed')
    def test_build_stamp_checksum_and_stage_identity(self):
        out=self.store.root/'release-fixture';rev='c'*40
        subprocess.run([sys.executable,'tools/build_release.py','--url','https://example.com/build.zip','--revision',rev,'--channel','experimental','--output',str(out)],check=True,capture_output=True)
        manifest=json.loads((out/'latest.json').read_text());raw=(out/f'MMSM-{__version__}-update.zip').read_bytes()
        self.assertEqual(manifest['revision'],rev);self.assertEqual(manifest['channel'],'experimental')
        self.assertEqual(hashlib.sha256(raw).hexdigest(),manifest['sha256'])
        import tempfile
        project=tempfile.TemporaryDirectory();self.addCleanup(project.cleanup);self.store.project_root=Path(project.name)
        self.manager.updater.stage(manifest,raw)
        with self.assertRaises(Problem):self.manager.updater.stage({**manifest,'revision':'d'*40},raw)
        with self.assertRaises(Problem):self.manager.updater.stage({**manifest,'channel':'stable'},raw)

class BrandingHTTP(support.HTTPTests):
    test_setup_auth_csrf_roles_and_session_revocation=None
    test_settings_persist_and_static_security_headers=None
    test_login_rate_limit=None
    test_operator_cannot_install_or_modify_files=None
    def test_favicon_public_default_custom_and_replacement(self):
        with urllib.request.urlopen(self.base+'/favicon.svg') as r:
            self.assertEqual(r.headers['Content-Type'],'image/svg+xml');self.assertIn(b'#a6ec80',r.read())
        self.owner();from PIL import Image
        import base64
        revision=None
        for color in ('blue','red'):
            image=io.BytesIO();Image.new('RGB',(64,64),color).save(image,format='PNG')
            self.assertEqual(self.request('/api/assets/logo','POST',{'image':base64.b64encode(image.getvalue()).decode()})[0],200)
            current=self.request('/api/appearance')[1]['logo_revision'];self.assertNotEqual(current,revision);revision=current
            with urllib.request.urlopen(self.base+'/favicon.svg?v='+current) as r:
                self.assertEqual(r.headers['Content-Type'],'image/png');actual=r.read()
                self.assertEqual(actual,(self.store.root/'images/logo.png').read_bytes());self.assertEqual(r.headers['Cache-Control'],'no-store')
    def test_channel_validation_and_status_reset(self):
        self.owner();self.manager.updater.state={'status':'available'}
        self.assertEqual(self.request('/api/settings','PUT',{'update_channel':'experimental'})[0],200)
        self.assertEqual(self.request('/api/settings')[1]['update_channel'],'experimental')
        self.assertEqual(self.manager.updater.status()['status'],'unchecked')
        self.assertEqual(self.request('/api/settings','PUT',{'update_channel':'unsafe'})[0],400)
