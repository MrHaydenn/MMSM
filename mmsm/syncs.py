"""Stopped-server, one-way folder mirrors. No symlinks or runtime/world paths."""
import contextlib
import copy
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import tempfile
import threading
import time
from .store import require, confined, Problem


class Syncs:
    def __init__(self, manager):
        self.m = manager
        self.lock = threading.RLock()

    def paths(self, folders):
        require(isinstance(folders, list) and len(folders) <= 20, 'Choose up to 20 folders')
        forbidden = {'world', 'world_nether', 'world_the_end', 'libraries', 'versions', 'logs', 'crash-reports', 'data', 'servers', 'backups', 'dependencies'}
        for name in folders:
            require(isinstance(name, str) and re.fullmatch(r'[A-Za-z0-9_-][A-Za-z0-9_.-]{0,79}', name)
                    and name.lower() not in forbidden, 'Choose top-level config/mod folders, not worlds or runtime folders')
        return sorted(set(folders))

    def digest(self, root, folders):
        h = hashlib.sha256(); total = count = 0
        for name in folders:
            folder = confined(root, name)
            require(not folder.exists() or folder.is_dir(), 'Sync selection must be a folder: ' + name)
            h.update((name + str(folder.exists())).encode())
            for p in sorted(folder.rglob('*')) if folder.exists() else []:
                require(not p.is_symlink(), 'Sync does not support symlinks')
                require(p.is_file() or p.is_dir(), 'Unsupported file in sync folder')
                h.update(p.relative_to(root).as_posix().encode()); h.update(b'D' if p.is_dir() else b'F')
                if p.is_file():
                    count += 1; total += p.stat().st_size
                    require(count <= 30000 and total <= 2 * 1024**3, 'Sync exceeds 30,000 files or 2 GB')
                    with p.open('rb') as stream:
                        for block in iter(lambda: stream.read(1024 * 1024), b''): h.update(block)
        return h.hexdigest()

    def save(self, sid, data):
        with self.lock:
            m = self.m; source_id = data.get('source_id')
            with m.locks[sid]:
                target = m.idle(sid)
                if not source_id:
                    target.pop('sync', None); m.store.save_server(target); return {'unlinked': True}
            require(source_id != sid, 'A server cannot sync from itself')
            source = m.active(source_id)
            require(not source.get('sync'), 'Choose a source that does not itself follow another server')
            require(not any(s.get('sync', {}).get('source_id') == sid for s in m.store.servers()), 'A source server cannot also become a sync destination')
            require(source['loader'] == target['loader'], 'Source and destination must use the same loader type')
            folders = self.paths(data.get('folders', [])); runtime = data.get('runtime') is True
            require(folders or runtime, 'Choose folders or loader-version sync')
            require(data.get('confirm') is True, 'Confirm replacing the selected destination folders')
            for name in folders:
                require(name != m.properties(source_id).get('level-name', 'world') and name != m.properties(sid).get('level-name', 'world'), 'World folders cannot be synced')
                require(confined(m.folder(source_id), name).is_dir(), 'Source folder does not exist: ' + name)
            with m.locks[sid]:
                target = m.idle(sid)
                target['sync'] = dict(source_id=source_id, folders=folders, runtime=runtime, settings=data.get('settings') is True, status='Pending first sync')
                m.store.save_server(target)
            return self.run(sid)

    def run(self, sid):
        thread = threading.current_thread()
        with self.m.lock:
            added = thread not in self.m.jobs
            self.m.jobs.add(thread)
        try:
            return self._run(sid)
        finally:
            if added:
                with self.m.lock: self.m.jobs.discard(thread)

    def _run(self, sid):
        m = self.m
        with self.lock:
            target = m.active(sid); rule = target.get('sync')
            require(rule, 'No sync configured', 409)
            source_id = rule['source_id']
            with contextlib.ExitStack() as stack:
                for key in sorted([sid, source_id]): stack.enter_context(m.locks[key])
                target = m.active(sid); rule = target.get('sync')
                if not rule: return {'unlinked': True}
                try:
                    source = m.active(source_id)
                    m.idle(sid); m.idle(source_id)
                    require(source['loader'] == target['loader'], 'Loader types no longer match')
                    folders = self.paths(rule['folders'])
                    require(rule['runtime'] or source['minecraft'] == target['minecraft'], 'Minecraft versions differ; enable loader-version sync or match versions first')
                    src = m.folder(source_id); dest = m.folder(sid)
                    for name in folders:
                        require(name not in (m.properties(sid).get('level-name', 'world'), m.properties(source_id).get('level-name', 'world')), 'World folders cannot be synced')
                    digest = self.digest(src, folders)
                    metadata = [m.properties(source_id) if rule.get('settings') else {}, source['minecraft'], source['loader_version'], source.get('mods', []) if 'mods' in folders or 'plugins' in folders else []]
                    signature = hashlib.sha256((digest + json.dumps(metadata, sort_keys=True)).encode()).hexdigest()
                    current = self.digest(dest, folders)
                    require(not rule.get('destination_digest') or current == rule['destination_digest'], 'Destination files changed outside MMSM. Unlink and recreate the sync to replace them.')
                    if rule.get('signature') != signature:
                        backup = m.store.root / 'sync-backups' / sid
                        stage = Path(tempfile.mkdtemp(prefix='sync-', dir=dest.parent))
                        moved = []; installed = []
                        try:
                            for name in folders:
                                if (src / name).exists(): shutil.copytree(src / name, stage / name, symlinks=True)
                            require(self.digest(stage, folders) == digest and self.digest(src, folders) == digest, 'Source changed while copying; retry after it stops changing')
                            if rule['runtime'] and (source['minecraft'], source['loader_version']) != (target['minecraft'], target['loader_version']):
                                m.install(sid, source['minecraft'], source['loader_version'])
                                target = m.store.server(sid)
                            if backup.exists(): shutil.rmtree(backup)
                            backup.mkdir(parents=True)
                            for name in folders:
                                if (dest / name).exists(): os.replace(dest / name, backup / name); moved.append(name)
                                if (stage / name).exists(): os.replace(stage / name, dest / name); installed.append(name)
                            if 'mods' in folders or 'plugins' in folders:
                                selected = set(folders)
                                target['mods'] = [x for x in target.get('mods', []) if x['path'].split('/')[0] not in selected] + [copy.deepcopy(x) for x in source.get('mods', []) if x['path'].split('/')[0] in selected]
                            rule.update(signature=signature, destination_digest=digest, last_sync=time.time())
                            target['sync'] = rule; rule['status'] = 'Up to date'
                            m.store.save_server(target)
                        except Exception:
                            for name in installed: shutil.rmtree(dest / name)
                            for name in moved: os.replace(backup / name, dest / name)
                            raise
                        finally: shutil.rmtree(stage, ignore_errors=True)
                    else:
                        rule['status'] = 'Up to date'; target['sync'] = rule; m.store.save_server(target)
                    if rule.get('settings'):
                        from .manager import PROTECTED_PROPERTIES
                        m.write_properties(m.store.server(sid), {k:v for k,v in m.properties(source_id).items() if k not in PROTECTED_PROPERTIES})
                    return rule
                except Exception as exc:
                    # Reload: an independently committed runtime update may have succeeded.
                    target = m.store.server(sid); target['sync']['status'] = 'Paused: ' + str(exc)
                    m.store.save_server(target)
                    return target['sync']

    def guard(self, sid, confirmed=False):
        with self.lock, self.m.locks[sid]:
            s = self.m.active(sid)
            if not s.get('sync'): return
            self.m.idle(sid)
            require(confirmed, 'SYNC_CONFLICT: This server follows another server. Making this change will disconnect its sync. Continue?', 409)
            s.pop('sync', None); self.m.store.save_server(s)

    def loop(self):
        while not self.m.closing.wait(30):
            if self.m.updater.installing: continue
            for s in self.m.store.servers(False):
                if s.get('sync'):
                    try: self.run(s['id'])
                    except Exception: pass
