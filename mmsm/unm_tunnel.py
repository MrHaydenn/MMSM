"""MMSM-owned OpenSSH tunnel; strict host verification and noninteractive authentication."""
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import threading
import time
import urllib.request
from .store import require

KEYS=('unm_tunnel_enabled','unm_ssh_host','unm_ssh_user','unm_ssh_port','unm_ssh_key','unm_local_port')

def validate(settings):
    require(type(settings.get('unm_tunnel_enabled',False)) is bool,'Invalid tunnel preference')
    if not settings.get('unm_tunnel_enabled'): return
    require(settings.get('dns_provider')=='unm','Select UNM DNS before enabling the tunnel')
    host=settings.get('unm_ssh_host',''); user=settings.get('unm_ssh_user','')
    require(isinstance(host,str) and re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9.:-]{0,252}',host),'Enter the VPS hostname or IP')
    require(isinstance(user,str) and re.fullmatch(r'[A-Za-z_][A-Za-z0-9_-]{0,63}',user),'Enter the SSH username')
    for key,low in [('unm_ssh_port',1),('unm_local_port',1024)]:
        require(type(settings.get(key)) is int and low<=settings[key]<=65535,'Invalid SSH or local tunnel port')
    key=settings.get('unm_ssh_key','')
    require(isinstance(key,str) and key and not any(c in key for c in '\r\n\0'),'Enter the private key file path on the MMSM host')
    require(Path(key).expanduser().is_file(),'SSH private key file was not found on the MMSM host')

class UNMTunnel:
    def __init__(self,manager):
        self.manager=manager; self.lock=threading.RLock(); self.process=None; self.config=None
        self.next_retry=0; self.last_error=''; self.state={'status':'disabled','message':'Managed SSH tunnel is off'}
        self.thread=None
        if manager.background:
            self.thread=threading.Thread(target=self.loop,daemon=True); self.thread.start()

    def status(self):
        with self.lock:return dict(self.state)

    def stop(self):
        process=self.process; self.process=None
        if process:
            if process.poll() is None:
                process.terminate()
                try: process.wait(timeout=5)
                except subprocess.TimeoutExpired: process.kill();process.wait(timeout=5)
            if process.stderr: process.stderr.close()

    def health(self,port):
        try:
            opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
            with opener.open('http://127.0.0.1:'+str(port)+'/healthz',timeout=2) as response:
                return json.load(response).get('ok') is True
        except Exception:return False

    def read_errors(self,process):
        try:
            for line in process.stderr:
                with self.lock:
                    if process is self.process:self.last_error=line.strip()[:500]
        except (OSError,ValueError):pass

    def tick(self):
        with self.lock:
            settings=self.manager.store.settings(); config=tuple(settings.get(k) for k in KEYS)
            if config!=self.config:
                self.stop();self.config=config;self.next_retry=0;self.last_error=''
            if not settings.get('unm_tunnel_enabled') or self.manager.closing.is_set():
                self.stop();self.state={'status':'disabled','message':'Managed SSH tunnel is off'};return
            try:validate(settings)
            except Exception as error:
                self.stop()
                self.state={'status':'error','message':str(error)};return
            if self.process and self.process.poll() is not None:
                self.stop();self.next_retry=time.monotonic()+15
                self.state={'status':'error','message':self.last_error or 'SSH exited. Check host trust, key/agent access, and whether the local port is occupied.'}
                return
            if not self.process:
                if time.monotonic()<self.next_retry:return
                executable=shutil.which('ssh')
                if not executable:
                    self.state={'status':'error','message':'OpenSSH client was not found on the MMSM host'};self.next_retry=time.monotonic()+30;return
                args=[executable,'-N','-T','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ExitOnForwardFailure=yes','-o','ServerAliveInterval=30','-o','ServerAliveCountMax=3','-o','ConnectTimeout=10','-o','IdentitiesOnly=yes','-i',str(Path(settings['unm_ssh_key']).expanduser()),'-p',str(settings['unm_ssh_port']),'-l',settings['unm_ssh_user'],'-L',f"127.0.0.1:{settings['unm_local_port']}:127.0.0.1:8787",settings['unm_ssh_host']]
                try:
                    self.process=subprocess.Popen(args,stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,text=True,creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
                    threading.Thread(target=self.read_errors,args=(self.process,),daemon=True).start()
                except OSError:
                    self.state={'status':'error','message':'Cannot start OpenSSH on the MMSM host'};self.next_retry=time.monotonic()+15;return
            connected=self.health(settings['unm_local_port'])
            self.state={'status':'connected' if connected else 'connecting','message':'Connected to UNM through SSH' if connected else 'Connecting. If this persists, check the key, SSH agent and known-host trust.'}

    def test(self):
        self.tick()
        return self.status()

    def loop(self):
        while not self.manager.closing.is_set():
            try:self.tick()
            except Exception:
                with self.lock:self.state={'status':'error','message':'Tunnel check failed; retrying'}
            if self.manager.closing.wait(5):break

    def close(self):
        if self.thread:self.thread.join(timeout=15)
        with self.lock:self.stop()
