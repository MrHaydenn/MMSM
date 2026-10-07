"""Install missing optional runtime dependencies into this project only."""
import importlib
from pathlib import Path
import subprocess
import sys


def ensure_dependencies(project):
    target=Path(project)/'dependencies'
    target.mkdir(parents=True,exist_ok=True)
    sys.path.insert(0,str(target))
    missing=[]
    for module,package in [('psutil','psutil>=6,<8'),('PIL','Pillow>=12,<14')]:
        try:importlib.import_module(module)
        except ImportError:missing.append(package)
    if not missing:return True
    print('MMSM: installing missing telemetry/image dependencies into',target,flush=True)
    try:
        subprocess.run([sys.executable,'-m','pip','--isolated','install','--disable-pip-version-check','--only-binary=:all:',
                        '--index-url','https://pypi.org/simple','--target',str(target),*missing],check=True,timeout=180)
        importlib.invalidate_caches()
        for module in ('psutil','PIL'):importlib.import_module(module)
        return True
    except (OSError,subprocess.SubprocessError,ImportError) as e:
        print('MMSM dependency setup could not finish:',e,'\nMMSM will continue. Check internet/pip and restart to retry.',flush=True)
        return False
