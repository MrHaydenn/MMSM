"""Owner-selected HTTPS release feeds and transactional program-only updates."""
import ast
import hashlib
import ipaddress
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import socket
import stat
import threading
import time
import urllib.parse
import urllib.request
import zipfile
from . import __version__
from .store import require, atomic_write, confined

LIMIT = 32 * 1024 * 1024

def version(value):
    require(isinstance(value,str) and re.fullmatch(r'\d+\.\d+\.\d+',value), 'Release versions must be major.minor.patch')
    return tuple(map(int,value.split('.')))

def validate_url(url):
    p=urllib.parse.urlsplit(url)
    require(p.scheme=='https' and p.hostname and not p.username and not p.password and not p.fragment and p.port in (None,443), 'Use a public HTTPS release URL')
    require(p.hostname.lower() not in ('localhost',) and not p.hostname.endswith('.local'),'Use a public release host')
    try: address=ipaddress.ip_address(p.hostname)
    except ValueError: address=None
    require(address is None or address.is_global,'Private release hosts are not allowed')
    return url

def public_url(url):
    validate_url(url)
    host=urllib.parse.urlsplit(url).hostname
    addresses=socket.getaddrinfo(host,443,type=socket.SOCK_STREAM)
    require(addresses and all(ipaddress.ip_address(x[4][0]).is_global for x in addresses),'Release host resolves to a private address')
    return url

class Redirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        public_url(newurl)
        return super().redirect_request(req,fp,code,msg,headers,newurl)

def fetch(url,limit):
    request=urllib.request.Request(public_url(url),headers={'User-Agent':'MMSM/'+__version__})
    with urllib.request.build_opener(Redirects()).open(request,timeout=20) as response:
        raw=response.read(limit+1)
    require(len(raw)<=limit,'Release download exceeds size limit')
    return raw

def program_path(name):
    p=PurePosixPath(name)
    require(not p.is_absolute() and '..' not in p.parts and '\\' not in name and ':' not in name and all(not x.endswith((' ','.')) for x in p.parts),'Unsafe release path')
    require((p.parts and p.parts[0]=='mmsm' and p.suffix in ('.py','.js','.css','.html','.svg','.png','.ico')) or name in ('start.bat','start.sh','README.md'), 'Release contains a non-program file: '+name)
    require(not any(part.lower() in ('data','servers','backups','dependencies','__pycache__') for part in p.parts),'Release contains bytecode')
    return p

def recover(project,work):
    """Undo an interrupted file transaction; a completed commit has no journal."""
    journal=work/'transaction.json'
    if not journal.exists():return
    rows=json.loads(journal.read_text())
    for row in reversed(rows):
        name=row['path'];program_path(name);dest=confined(project,name)
        if row['existed']:
            source=confined(work/'rollback',name)
            atomic_write(dest,source.read_bytes())
        else: dest.unlink(missing_ok=True)
    journal.unlink()

def apply(project,work):
    stage=work/'stage';names=json.loads((work/'files.json').read_text())
    recover(project,work)
    rollback=work/'rollback'
    if rollback.exists():shutil.rmtree(rollback)
    rows=[]
    for name in names:
        program_path(name);dest=confined(project,name)
        require(not dest.exists() or dest.is_file(),'Program destination is not a file')
        if dest.exists():atomic_write(confined(rollback,name),dest.read_bytes())
        rows.append({'path':name,'existed':dest.exists()})
    atomic_write(work/'transaction.json',json.dumps(rows))
    try:
        for name in names:
            atomic_write(confined(project,name),confined(stage,name).read_bytes())
        for cache in (project/'mmsm').rglob('*.pyc'):
            confined(project,cache.relative_to(project).as_posix()).unlink()
        (work/'transaction.json').unlink()
    except BaseException:
        recover(project,work)
        raise
    # Keep exactly one previous program backup; never touch data or worlds.
    shutil.rmtree(stage)
    (work/'files.json').unlink(missing_ok=True)

class Updater:
    def __init__(self,manager):
        self.manager=manager;self.store=manager.store
        self.work=self.store.root/'updates'
        self.lock=threading.RLock();self.installing=False;self.pending=False
        self.state={'status':'unconfigured','current':__version__}
        self.last_check=0;self.manifest=None;self.feed=None
        self.shutdown=None

    def status(self):
        return dict(self.state,current=__version__)

    def check(self):
        with self.lock:
            require(not self.installing,'An update is already installing',409)
            feed=self.store.settings()['update_feed'];self.last_check=time.time()
            self.manifest=None;self.feed=feed
            if not feed:
                self.state={'status':'unconfigured'};return self.status()
            try:
                data=json.loads(fetch(feed,256*1024))
                require(isinstance(data,dict),'Invalid release manifest')
                newer=version(data.get('version'))>version(__version__)
                validate_url(data.get('url',''))
                require(isinstance(data.get('sha256'),str) and re.fullmatch(r'[0-9a-f]{64}',data['sha256']),'Invalid release SHA-256')
                self.manifest=data
                self.state={'status':'available' if newer else 'current','latest':data['version'],'checked':time.time()}
                if newer:self.store.notify(None,'MMSM '+data['version']+' is available. Open Settings to update.','wrapper:'+data['version'],'wrapper',{'tab':'settings'})
            except Exception as e:
                self.state={'status':'failed','error':str(e),'checked':time.time()}
            return self.status()

    def due(self):
        if self.installing or not self.store.settings()['wrapper_update_checks']:return
        if time.time()-self.last_check>=6*3600:self.check()

    def stage(self,data,raw):
        require(hashlib.sha256(raw).hexdigest()==data['sha256'],'Update checksum does not match')
        import io
        stage=self.work/'stage'
        if stage.exists():shutil.rmtree(stage)
        stage.mkdir(parents=True,exist_ok=True)
        names=[];seen=set();total=0
        try:
            with zipfile.ZipFile(io.BytesIO(raw)) as z:
                require(len(z.infolist())<=2000,'Too many release files')
                for info in z.infolist():
                    require(not stat.S_ISLNK(info.external_attr>>16),'Release symlinks are not allowed')
                    if info.is_dir():continue
                    # Release builder produces paths relative to the project root.
                    name=info.filename;program_path(name)
                    target=confined(self.store.project_root,name)
                    require(not target.is_relative_to(self.store.root),'Release targets the data directory')
                    require(name.casefold() not in seen,'Duplicate release path');seen.add(name.casefold())
                    total+=info.file_size;require(total<=128*1024*1024,'Expanded release is too large')
                    content=z.read(info)
                    if name.endswith('.py'):ast.parse(content,filename=name)
                    atomic_write(confined(stage,name),content);names.append(name)
            required={'mmsm/__init__.py','mmsm/__main__.py','mmsm/store.py','mmsm/manager.py','mmsm/web.py','mmsm/updater.py','mmsm/static/app.js','mmsm/static/index.html','mmsm/static/style.css'}
            require(required<=set(names),'Incomplete MMSM release')
            module=ast.parse((stage/'mmsm/__init__.py').read_text())
            declared=[n.value.value for n in module.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='__version__' for t in n.targets) and isinstance(n.value,ast.Constant)]
            require(declared==[data['version']],'Package version does not match release manifest')
            atomic_write(self.work/'files.json',json.dumps(names))
        except Exception:
            shutil.rmtree(stage,ignore_errors=True);raise

    def prepare(self):
        with self.lock:
            require(self.shutdown is not None,'Updates require launching MMSM through its normal entry point',409)
            self.check()
            require(self.state['status']=='available',self.state.get('error','No newer release is available'),409)
            require(not self.manager.jobs and not any(self.manager.alive(s['id']) for s in self.store.servers()),'Stop all servers and wait for operations before updating',409)
            self.installing=True;self.state['status']='installing'
            try:
                self.stage(self.manifest,fetch(self.manifest['url'],LIMIT))
                require(not self.manager.jobs and not any(self.manager.alive(s['id']) for s in self.store.servers()),'A server operation started; stop it and retry',409)
                self.pending=True
            except Exception as e:
                self.installing=False;self.state={'status':'failed','error':str(e),'checked':time.time()};raise
        return {'restarting':True}
