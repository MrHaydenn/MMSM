from unittest.mock import patch
import socket
import time
import test_manager as support
from mmsm.network import status

class WakeHistory(support.Base):
    def test_real_join_records_peer_and_deduplicates_and_cancel(self):
        s=support.server(self.store,sleep=True);sid=s['id'];s['launch']={'java_major':17};self.store.save_server(s)
        self.manager.sleep_now(sid);jobs=[]
        with patch.object(self.manager,'spawn_job',side_effect=jobs.append):
            status(s['port']);self.assertNotIn('wake_history',self.store.server(sid))
            support.join_request(s['port']);support.join_request(s['port'])
        rows=self.store.server(sid)['wake_history']
        self.assertEqual(len(rows),1);self.assertEqual(len(jobs),1)
        self.assertEqual(rows[0]['reason'],'Minecraft join handshake')
        self.assertEqual(rows[0]['source_ip'],'127.0.0.1')
        s=self.store.server(sid);s['manual_stop']=True;self.store.save_server(s)
        jobs[0]();self.assertEqual(self.store.server(sid)['wake_history'][0]['result'],'Cancelled')

    def test_wake_history_is_bounded_and_survives_reload(self):
        s=support.server(self.store,sleep=True);sid=s['id']
        with patch.object(self.manager,'spawn_job'):
            for i in range(55):
                self.manager.set_state(sid,status='sleeping');self.manager.wake(sid,reason='Minecraft join handshake',source_ip='192.0.2.1')
        rows=self.store.server(sid)['wake_history'];self.assertEqual(len(rows),50)
        self.assertEqual(rows[0]['reason'],'Minecraft join handshake')
        self.assertEqual(self.manager.public(self.store.server(sid))['wake_history'],rows)
