#!/usr/bin/env python3
"""Build update-only ZIP + latest.json for an HTTPS release host (does not publish)."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import zipfile
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root))
from mmsm import __version__
from mmsm.updater import program_path, validate_url
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--url',required=True,help='Final public HTTPS URL of the release ZIP')
p.add_argument('--output',default=str(root/'release'))
a=p.parse_args();validate_url(a.url)
out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
archive=out/f'MMSM-{__version__}-update.zip'
files=list((root/'mmsm').rglob('*'))+[root/'start.bat',root/'start.sh',root/'README.md']
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for file in sorted(files):
        if not file.is_file() or file.is_symlink() or '__pycache__' in file.parts:continue
        name=file.relative_to(root).as_posix();program_path(name);z.write(file,name)
manifest={'version':__version__,'url':a.url,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest()}
(out/'latest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(archive);print(out/'latest.json')
