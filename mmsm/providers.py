"""Upstream catalogs, checked downloads and managed Java runtimes."""
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import secrets
import shutil
import subprocess
import tarfile
import threading
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

from .store import Problem, require, confined, atomic_write

MOJANG = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'
FABRIC = 'https://meta.fabricmc.net/v2'
PAPER = 'https://fill.papermc.io/v3/projects/paper'
MODRINTH = 'https://api.modrinth.com/v2'
FORGE = 'https://maven.minecraftforge.net/net/minecraftforge/forge'
NEOFORGE = 'https://maven.neoforged.net/releases/net/neoforged/neoforge'
HOSTS = {'api.mojang.com', 'sessionserver.mojang.com', 'textures.minecraft.net', 'piston-meta.mojang.com', 'piston-data.mojang.com', 'launcher.mojang.com',
         'launchermeta.mojang.com', 'meta.fabricmc.net', 'maven.fabricmc.net',
         'fill.papermc.io', 'fill-data.papermc.io', 'maven.minecraftforge.net',
         'maven.neoforged.net', 'api.modrinth.com', 'cdn.modrinth.com',
         'api.adoptium.net', 'github.com', 'objects.githubusercontent.com',
         'release-assets.githubusercontent.com', 'raw.githubusercontent.com'}


def checked_url(url):
    u = urllib.parse.urlparse(url)
    require(u.scheme == 'https' and u.hostname in HOSTS and not u.username and not u.password
            and u.port in (None, 443), 'Download URL is not from an approved upstream: ' + str(u.hostname))
    return url


class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        checked_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def version_key(value):
    return tuple(int(x) for x in re.findall(r'\d+', value))


class Providers:
    def __init__(self, store):
        self.store = store
        self.cache = {}
        self.java_lock = threading.Lock()
        self.opener = urllib.request.build_opener(SafeRedirect())
        for row in store.rows('SELECT * FROM downloads'):
            d = json.loads(row['data'])
            if d['status'] in ('queued', 'downloading'):
                d.update(status='interrupted', error='Manager restarted during download')
                self.save_download(d)

    def open(self, url):
        checked_url(url)
        contact = self.store.settings()['upstream_contact']
        if urllib.parse.urlparse(url).hostname == 'fill.papermc.io':
            require(contact, 'Set your contact URL or email in Settings before using the Paper download API')
        agent = 'MMSM/0.8.0' + (' (' + contact + ')' if contact else '')
        return self.opener.open(urllib.request.Request(url, headers={'User-Agent': agent, 'Accept': 'application/json'}), timeout=45)

    def get(self, url, raw=False):
        cached = self.cache.get(url)
        if cached and cached[0] > time.time():
            return cached[1]
        try:
            with self.open(url) as response:
                data = response.read(16 * 1024 * 1024 + 1)
                require(len(data) <= 16 * 1024 * 1024, 'Upstream response is too large')
                result = data if raw else json.loads(data)
        except Problem:
            raise
        except Exception as e:
            raise Problem('Upstream request failed: ' + str(e), 502) from e
        self.cache[url] = (time.time() + 300, result)
        return result

    def save_download(self, d):
        self.store.execute('INSERT OR REPLACE INTO downloads VALUES(?,?)', (d['id'], json.dumps(d)))
        if d['status'] not in ('queued','downloading'): self.store.prune_downloads()

    def download(self, url, dest, hashes=None, sid=None):
        checked_url(url)
        dest = Path(dest)
        dest.parent.mkdir(parents=True, exist_ok=True)
        d = dict(id=secrets.token_hex(12), name=dest.name, server_id=sid, status='queued', bytes=0,
                 total=None, created=time.time(), error=None, destination=str(dest.resolve()), source=url,
                 server_name=self.store.server(sid)['name'] if sid else 'Shared Java/runtime')
        self.save_download(d)
        tmp = dest.with_name(dest.name + '.' + d['id'] + '.part')
        try:
            d['status'] = 'downloading'
            self.save_download(d)
            algos = {k: hashlib.new(k) for k in (hashes or {}) if k in ('sha1', 'sha256', 'sha512')}
            with self.open(url) as response, tmp.open('wb') as f:
                d['total'] = int(response.headers.get('Content-Length') or 0) or None
                last = 0
                while chunk := response.read(128 * 1024):
                    d['bytes'] += len(chunk)
                    require(d['bytes'] <= 2 * 1024**3, 'Download exceeds 2 GiB limit')
                    f.write(chunk)
                    for digest in algos.values():
                        digest.update(chunk)
                    if time.monotonic() - last > 0.5:
                        self.save_download(d)
                        last = time.monotonic()
            require(d['total'] is None or d['bytes'] == d['total'], 'Incomplete download')
            for algo, digest in algos.items():
                require(digest.hexdigest().lower() == hashes[algo].lower(), 'Checksum mismatch for ' + dest.name)
            os.replace(tmp, dest)
            d.update(status='completed', finished=time.time())
            self.save_download(d)
            return dest
        except Exception as e:
            d.update(status='failed', error=str(e), finished=time.time())
            self.save_download(d)
            raise
        finally:
            tmp.unlink(missing_ok=True)

    def mark_installed(self,sid,source,target):
        source=Path(source).resolve();target=Path(target).resolve()
        for row in self.store.rows("SELECT data FROM downloads WHERE json_extract(data,'$.server_id')=?",(sid,)):
            item=json.loads(row['data'])
            if item.get('destination') and Path(item['destination']).is_relative_to(source):
                item['installed_to']=str(target/Path(item['destination']).relative_to(source))
                self.save_download(item)

    def minecraft(self):
        return self.get(MOJANG)['versions']

    def manifest(self, mc):
        entry = next((v for v in self.minecraft() if v['id'] == mc), None)
        require(entry, 'Unknown Minecraft version')
        return self.get(entry['url'])

    def maven_versions(self, loader):
        base = FORGE if loader == 'forge' else NEOFORGE
        root = ET.fromstring(self.get(base + '/maven-metadata.xml', raw=True))
        return sorted([v.text for v in root.findall('./versioning/versions/version')], key=version_key, reverse=True)

    def catalog(self, loader, mc=None):
        require(loader in ('vanilla', 'fabric', 'forge', 'neoforge', 'paper'), 'Unknown loader')
        if loader == 'vanilla':
            return {'minecraft': [v['id'] for v in self.minecraft()], 'versions': [mc] if mc else []}
        if loader == 'fabric':
            games = [v['version'] for v in self.get(FABRIC + '/versions/game')]
            versions = self.get(FABRIC + '/versions/loader/' + urllib.parse.quote(mc, safe='')) if mc else []
            return {'minecraft': games, 'versions': [v['loader']['version'] for v in versions]}
        if loader == 'paper':
            groups = self.get(PAPER)['versions']
            games = [v for group in groups.values() for v in group]
            builds = self.get(PAPER + '/versions/' + urllib.parse.quote(mc, safe='') + '/builds') if mc else []
            return {'minecraft': games, 'versions': [str(b['id']) for b in builds],
                    'channels': {str(b['id']): b['channel'] for b in builds}}
        versions = self.maven_versions(loader)
        if loader == 'forge':
            games = sorted({v.split('-')[0] for v in versions}, key=version_key, reverse=True)
            return {'minecraft': games, 'versions': [v for v in versions if mc and v.startswith(mc + '-')]}
        # NeoForge 20.2.x -> Minecraft 1.20.2, 21.1.x -> 1.21.1 (21.0.x -> 1.21).
        def game(v):
            parts = v.split('.')
            if len(parts) < 3 or not parts[0].isdigit() or not parts[1].isdigit():
                return None
            major, minor = int(parts[0]), int(parts[1])
            if major < 26:
                return '1.' + str(major) + ('.' + str(minor) if minor else '')
            return '.'.join(parts[:2])
        mapping = {v: game(v) for v in versions}
        return {'minecraft': sorted({x for x in mapping.values() if x}, key=version_key, reverse=True),
                'versions': [v for v in versions if mc and mapping[v] == mc]}

    def java(self, major):
        with self.java_lock:
            system_java = shutil.which('java')
            if system_java:
                try:
                    output = subprocess.run([system_java, '-version'], capture_output=True, text=True, timeout=15).stderr
                    match = re.search(r'version "(?:1\.)?(\d+)', output)
                    if match and int(match[1]) == major:
                        return system_java
                except (OSError, subprocess.TimeoutExpired):
                    pass
            home = self.store.root / 'java' / str(major)
            exe = 'java.exe' if os.name == 'nt' else 'java'
            existing = (list(home.glob('*/bin/' + exe)) + list(home.glob('*/Contents/Home/bin/' + exe))) if home.exists() else []
            if existing:
                return str(existing[0])
            operating = {'Linux': 'linux', 'Windows': 'windows', 'Darwin': 'mac'}.get(platform.system())
            arch = {'x86_64': 'x64', 'AMD64': 'x64', 'aarch64': 'aarch64', 'arm64': 'aarch64'}.get(platform.machine())
            require(operating and arch, 'Automatic Java download is not available for this platform')
            assets = self.get(f'https://api.adoptium.net/v3/assets/latest/{major}/hotspot?' + urllib.parse.urlencode(
                dict(architecture=arch, image_type='jdk', os=operating, vendor='eclipse')))
            require(assets, 'No suitable Java runtime available')
            package = assets[0]['binary']['package']
            archive = self.download(package['link'], self.store.root / 'downloads' / Path(package['name']).name,
                                    {'sha256': package['checksum']})
            stage = home.with_name(home.name + '-staging')
            shutil.rmtree(stage, ignore_errors=True)
            stage.mkdir()
            try:
                if archive.suffix == '.zip':
                    safe_unzip(archive, stage)
                else:
                    with tarfile.open(archive) as tar:
                        require(sum(m.size for m in tar.getmembers()) <= 4 * 1024**3, 'Java archive too large')
                        tar.extractall(stage, filter='data')
                found = list(stage.glob('*/bin/' + exe))
                if not found:  # macOS JDK bundle layout
                    found = list(stage.glob('*/Contents/Home/bin/' + exe))
                require(found, 'Downloaded Java runtime has no java executable')
                relative = found[0].relative_to(stage)
                subprocess.run([str(found[0]), '-version'], check=True, capture_output=True, timeout=30)
                shutil.rmtree(home, ignore_errors=True)
                os.replace(stage, home)
                return str(home / relative)
            finally:
                shutil.rmtree(stage, ignore_errors=True)

    def install_loader(self, server, directory):
        root = Path(directory)
        root.mkdir(parents=True, exist_ok=True)
        mc, loader, version = server['minecraft'], server['loader'], server['loader_version']
        require(version in self.catalog(loader, mc)['versions'], 'Loader version is not available for this Minecraft version')
        manifest = self.manifest(mc)
        major = manifest.get('javaVersion', {}).get('majorVersion', 8)
        if loader == 'paper' and version_key(mc) >= (1, 20):
            major = max(21, major)
        java = self.java(major)
        sid = server['id']
        if loader == 'vanilla':
            artifact = manifest['downloads']['server']
            self.download(artifact['url'], root / 'server.jar', {'sha1': artifact['sha1']}, sid)
            args = ['-jar', 'server.jar', 'nogui']
        elif loader == 'fabric':
            installers = self.get(FABRIC + '/versions/installer')
            installer = next((i['version'] for i in installers if i.get('stable')), installers[0]['version'])
            self.download(f'{FABRIC}/versions/loader/{urllib.parse.quote(mc)}/{urllib.parse.quote(version)}/{installer}/server/jar', root / 'server.jar', sid=sid)
            args = ['-jar', 'server.jar', 'nogui']
        elif loader == 'paper':
            build = next(b for b in self.get(PAPER + '/versions/' + urllib.parse.quote(mc) + '/builds') if str(b['id']) == version)
            artifact = build['downloads']['server:default']
            hashes = artifact.get('checksums', {})
            self.download(artifact['url'], root / 'server.jar', hashes, sid)
            args = ['-jar', 'server.jar', 'nogui']
        else:
            base = FORGE if loader == 'forge' else NEOFORGE
            name = 'forge' if loader == 'forge' else 'neoforge'
            self.download(f'{base}/{version}/{name}-{version}-installer.jar', root / 'installer.jar', sid=sid)
            with (root / 'installer.log').open('w') as log:
                result = subprocess.run([java, '-jar', 'installer.jar', '--installServer'], cwd=root, stdout=log,
                                        stderr=subprocess.STDOUT, timeout=900)
            require(result.returncode == 0, 'Loader installer failed; see runtime/installer.log', 502)
            argfile = 'win_args.txt' if os.name == 'nt' else 'unix_args.txt'
            files = list(root.glob('libraries/**/' + argfile))
            if files:
                # Argfiles use relative libraries/ paths: launch from runtime/.
                args = ['@' + str(files[0].relative_to(root)), 'nogui']
            else:
                jars = [p for p in root.glob('forge-*.jar') if 'installer' not in p.name]
                require(jars, 'Installer did not produce a supported launch artifact')
                args = ['-jar', jars[0].name, 'nogui']
        return {'java': java, 'java_major': major, 'args': args}

    def search(self, query, loader, mc, project_type='mod', offset=0, limit=12, index='downloads'):
        require(index in ('downloads', 'relevance', 'follows', 'newest', 'updated'), 'Unknown sort order')
        require(project_type in ('mod', 'plugin', 'modpack'), 'Unknown project type')
        require(type(offset) is int and 0 <= offset <= 1000000, 'Invalid search offset')
        require(type(limit) is int and 1 <= limit <= 100, 'Invalid page size')
        # V2 historically classifies Bukkit-family plugins as mods. The newer
        # all_project_types facet also exposes plugin as a distinct type.
        facets = [['project_type:mod', 'all_project_types:plugin']] if project_type == 'plugin' else [[f'project_type:{project_type}']]
        if project_type == 'plugin':
            facets.append([f'categories:{x}' for x in ('paper','spigot','bukkit')])
        elif loader and project_type != 'modpack':
            facets.append([f'categories:{x}' for x in self.compatible_loaders(loader)])
        if mc:
            facets.append([f'versions:{mc}'])
        return self.get(MODRINTH + '/search?' + urllib.parse.urlencode({'query': query, 'offset': offset, 'limit': limit, 'index': index, 'facets': json.dumps(facets)}))

    @staticmethod
    def compatible_loaders(loader):
        return ['paper', 'spigot', 'bukkit'] if loader == 'paper' else [loader]

    def mod_versions(self, project, server):
        return self.get(MODRINTH + '/project/' + urllib.parse.quote(project, safe='') + '/version?' + urllib.parse.urlencode({
            'loaders': json.dumps(self.compatible_loaders(server['loader'])), 'game_versions': json.dumps([server['minecraft']]), 'include_changelog':'false'}))

    def mod_version(self, vid):
        return self.get(MODRINTH + '/version/' + urllib.parse.quote(vid, safe=''))


def safe_unzip(archive, dest, prefix=None):
    with zipfile.ZipFile(archive) as z:
        members = z.infolist()
        require(len(members) <= 50000 and sum(m.file_size for m in members) <= 4 * 1024**3, 'Archive exceeds extraction limits')
        for info in members:
            if prefix is not None and not info.filename.startswith(prefix):
                continue
            name = info.filename[len(prefix):] if prefix is not None else info.filename
            if not name or info.is_dir():
                continue
            require((info.external_attr >> 16) & 0o170000 != 0o120000, 'Archive symlinks are not permitted')
            p = confined(dest, name)
            atomic_write(p, z.read(info))
