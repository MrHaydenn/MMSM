from unittest.mock import MagicMock, patch
import io
from pathlib import Path
import test_manager as support
from mmsm.unm_tunnel import validate
from mmsm.store import Problem

class Tunnel(support.Base):
    def setUp(self):
        super().setUp()
        self.key=Path(self.temp.name)/'key';self.key.write_text('fixture-only')
        self.store.set_settings(dict(dns_provider='unm',unm_tunnel_enabled=True,unm_ssh_host='157.230.239.126',unm_ssh_user='root',unm_ssh_port=22,unm_ssh_key=str(self.key),unm_local_port=8790))
        self.process=MagicMock();self.process.poll.return_value=None;self.process.stderr=io.StringIO('')
        self.spawn=patch('mmsm.unm_tunnel.subprocess.Popen',return_value=self.process).start();self.addCleanup(patch.stopall)
        patch('mmsm.unm_tunnel.shutil.which',return_value='/usr/bin/ssh').start()
        patch.object(self.manager.unm_tunnel,'health',return_value=True).start()

    def test_strict_noninteractive_launch_no_duplicate_reconnect_and_shutdown(self):
        tunnel=self.manager.unm_tunnel
        tunnel.tick();self.assertEqual(tunnel.status()['status'],'connected')
        args=self.spawn.call_args.args[0]
        self.assertIn('BatchMode=yes',args);self.assertIn('StrictHostKeyChecking=yes',args)
        self.assertIn('127.0.0.1:8790:127.0.0.1:8787',args)
        self.assertEqual(self.spawn.call_args.kwargs['stdin'],-3)
        tunnel.tick();self.assertEqual(self.spawn.call_count,1)
        self.process.poll.return_value=1;tunnel.tick()
        self.assertEqual(tunnel.status()['status'],'error')
        tunnel.tick();self.assertEqual(self.spawn.call_count,1)
        replacement=MagicMock();replacement.poll.return_value=None;replacement.stderr=io.StringIO('')
        self.spawn.return_value=replacement;tunnel.next_retry=0;tunnel.tick()
        self.assertEqual(self.spawn.call_count,2)
        self.manager.close();replacement.terminate.assert_called_once()

    def test_disabled_and_config_change_stop_only_owned_process(self):
        tunnel=self.manager.unm_tunnel;tunnel.tick()
        self.store.set_settings({'unm_tunnel_enabled':False});tunnel.tick()
        self.assertEqual(tunnel.status()['status'],'disabled')
        self.process.terminate.assert_called_once()
        self.assertIsNone(tunnel.process)

    def test_missing_key_and_invalid_preferences(self):
        settings=self.store.settings()
        for changes in ({'unm_ssh_host':'-proxy'},{'unm_ssh_user':'root\ncommand'},{'unm_local_port':80},{'unm_ssh_key':'missing-file'},{'dns_provider':'cloudflare'}):
            with self.assertRaises(Problem):validate(dict(settings,**changes))
        self.key.unlink();self.manager.unm_tunnel.tick()
        self.assertEqual(self.manager.unm_tunnel.status()['status'],'error')
        self.spawn.assert_not_called()

class TunnelHTTP(support.HTTPTests):
    test_setup_auth_csrf_roles_and_session_revocation=None
    test_settings_persist_and_static_security_headers=None
    test_login_rate_limit=None
    test_operator_cannot_install_or_modify_files=None
    def test_connection_test_requires_login_and_settings_use_managed_url(self):
        self.assertEqual(self.request('/api/unm-connection/test','POST',{})[0],401)
        self.owner()
        self.assertEqual(self.request('/api/unm-connection')[1]['status'],'disabled')
        self.assertEqual(self.request('/api/unm-connection/test','POST',{})[1]['status'],'disabled')
        key=Path(self.temp.name)/'key';key.write_text('fixture')
        settings=dict(dns_provider='unm',unm_tunnel_enabled=True,unm_ssh_host='157.230.239.126',unm_ssh_user='root',unm_ssh_key=str(key),unm_ssh_port=22,unm_local_port=8791)
        self.assertEqual(self.request('/api/settings','PUT',settings)[0],200)
        self.assertEqual(self.store.settings()['unm_url'],'http://127.0.0.1:8791')
