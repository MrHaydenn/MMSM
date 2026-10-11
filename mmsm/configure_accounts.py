"""Run with MMSM stopped: python -m mmsm.configure_accounts --data data."""
import argparse
from contextlib import closing
import getpass
import json
import os
from pathlib import Path
import sqlite3
import time
from .store import Store, atomic_write, require
from .central_identity import request


def replace_accounts(store, cfg, identity):
    require(identity.get('admin') and 'mmsm' in identity.get('memberships', []), 'Use an active account administrator with MMSM application access')
    backup = store.root / ('mmsm.before-central-' + str(time.time_ns()) + '.sqlite3')
    with closing(sqlite3.connect(backup)) as destination:
        store.db.backup(destination)
    target = store.root / 'account-service.json'
    previous = target.read_bytes() if target.exists() else None
    try:
        with store.lock, store.db:
            for table in ('sessions','launcher_connections','launcher_pairings','dismissed_downloads','notification_reads','users'):
                store.db.execute('DELETE FROM ' + table)
            store.db.execute('INSERT INTO users(id,username,password,role,created,server_ids) VALUES(?,?,?,?,?,NULL)',
                (identity['id'],identity['username'],'central-identity-only','owner',time.time()))
            atomic_write(target,json.dumps(cfg,indent=2))
    except Exception:
        if previous is None:
            target.unlink(missing_ok=True)
        else:
            atomic_write(target,previous)
        raise
    return backup


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data',default=os.environ.get('MMSM_DATA',str(Path(__file__).resolve().parents[1]/'data')))
    args=parser.parse_args()
    root=Path(args.data).resolve();root.mkdir(parents=True,exist_ok=True)
    with (root/'manager.lock').open('a+b') as lock:
        if os.name=='nt':
            import msvcrt
            lock.seek(0);lock.write(b'0');lock.flush();lock.seek(0)
            msvcrt.locking(lock.fileno(),msvcrt.LK_NBLCK,1)
        else:
            import fcntl
            fcntl.flock(lock.fileno(),fcntl.LOCK_EX|fcntl.LOCK_NB)
        store=Store(root)
        try:
            cfg={'url':'https://accounts.mrhaydenn.us','client_id':'mmsm','key':getpass.getpass('MMSM client key (clients.mmsm in account server config.json): ')}
            require(bool(cfg['key']), 'Client key is required')
            username=input('Shared administrator username: ').strip()
            password=getpass.getpass('Shared administrator password: ')
            # Validate credentials and the client key before touching local accounts/configuration.
            result=request(store,'login',{'username':username,'password':password,'audience':'mmsm'},False,configuration=cfg)
            identity=request(store,'introspect',{'token':result['token']},configuration=cfg)['user']
            backup=replace_accounts(store,cfg,identity)
            print('Shared accounts enabled. Sign in to MMSM as '+identity['username']+'.')
            print('Previous local accounts removed; database backup: '+str(backup))
        finally:
            store.db.close()


if __name__=='__main__':
    try:
        main()
    except Exception as error:
        raise SystemExit('Setup failed (stop MMSM before running setup): '+str(error))
