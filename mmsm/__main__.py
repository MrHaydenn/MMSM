import argparse
import atexit
import os
from pathlib import Path
import signal
import sys
import threading

from .store import Store


def main():
    project = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description="MrHaydenn's Minecraft Server Manager")
    parser.add_argument('--data', default=os.environ.get('MMSM_DATA', str(project / 'data')))
    parser.add_argument('--host', default=os.environ.get('MMSM_HOST'))
    parser.add_argument('--port', type=int, help='Override saved WebGUI port')
    parser.add_argument('--origin', default=os.environ.get('MMSM_ORIGIN'), help='Public WebGUI origin, e.g. https://mmsm.example.com')
    parser.add_argument('--proxy-host', default='0.0.0.0')
    args = parser.parse_args()
    root = Path(args.data).resolve()
    root.mkdir(parents=True, exist_ok=True)
    lock = (root / 'manager.lock').open('a+b')
    try:
        if os.name == 'nt':
            import msvcrt
            lock.seek(0); lock.write(b'0'); lock.flush(); lock.seek(0)
            msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        sys.exit('Another MMSM process already owns this data directory.')
    from .updater import recover, apply
    recover(project, root/'updates')
    from .bootstrap import ensure_dependencies
    ensure_dependencies(project)
    from .manager import Manager
    from .web import WebServer
    store = Store(root, project_root=project)
    from .web_config import startup_network
    host, origin = startup_network(store.settings(), args.host, args.origin)
    manager = Manager(store, proxy_host=args.proxy_host)
    port = args.port or store.settings()['web_port']
    if args.port:
        store.set_settings({'web_port': args.port})
    try:
        web = WebServer((host, port), manager, origin)
    except OSError as e:
        manager.close()
        sys.exit('Cannot bind WebGUI: ' + str(e))
    print(f'\nMMSM — MrHaydenn\'s Minecraft Server Manager\nWebGUI: http://127.0.0.1:{web.server_port}\nData: {root}', flush=True)
    print(f'Listening on {host}:{web.server_port} | Public URL: {origin or "direct IP access enabled"}',flush=True)
    if not store.rows('SELECT 1 FROM users LIMIT 1'):
        print('First-run owner setup token: ' + web.setup_token, flush=True)
    def shutdown(*_):
        threading.Thread(target=web.shutdown, daemon=True).start()
    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)
    manager.updater.shutdown = web.shutdown
    manager.start_configured_servers()
    try:
        web.serve_forever()
    finally:
        print('Stopping MMSM and saving Minecraft worlds…', flush=True)
        failures = manager.close()
        web.server_close()
        if failures:
            print('Shutdown needs attention: ' + '; '.join(failures), flush=True)
        if manager.updater.pending:
            if failures or any(job.is_alive() for job in manager.jobs):
                print('Update cancelled: server operations did not finish safely.',flush=True)
            else:
                try: apply(project,manager.updater.work)
                except Exception as e: print('Update failed; previous program files restored: '+str(e),flush=True)
                else: print('MMSM updated. Restarting…',flush=True)
                store.db.close();lock.close()
                os.execv(sys.executable,[sys.executable,'-m','mmsm',*sys.argv[1:]])
        lock.close()


if __name__ == '__main__':
    main()
