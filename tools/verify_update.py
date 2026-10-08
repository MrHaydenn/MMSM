#!/usr/bin/env python3
"""Verify a published update through MMSM's real downloader and package staging."""
import argparse
from pathlib import Path
import sys
import tempfile
import time
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from mmsm.manager import Manager
from mmsm.store import Store
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--channel',choices=['stable','experimental'],default='stable')
p.add_argument('--expected-revision',required=True)
a=p.parse_args()
with tempfile.TemporaryDirectory() as tmp:
    store=Store(Path(tmp)/'data',project_root=Path(tmp));store.set_settings({'update_channel':a.channel})
    manager=Manager(store,start_background=False);updater=manager.updater;updater.shutdown=lambda:None
    try:
        for attempt in range(10):
            try:
                with patch('mmsm.updater.__version__','0.0.0'),patch('mmsm.updater.__revision__',''):
                    state=updater.check()
                    assert state['status']=='available',state
                    assert state['revision']==a.expected_revision,state
                    assert updater.prepare()['restarting']
                assert (updater.work/'stage/mmsm/web.py').is_file()
                print('Live manifest, ZIP, checksum, commit identity and staging verified:',a.channel,state['revision'])
                break
            except Exception:
                if attempt==9:raise
                time.sleep(2)
    finally:
        manager.close();store.db.close()
