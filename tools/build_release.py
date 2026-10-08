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
p.add_argument('--revision',default='',help='Git commit SHA to stamp in the package')
p.add_argument('--channel',choices=['stable','experimental'],default='stable')
p.add_argument('--archive-name',default='')
p.add_argument('--output',default=str(root/'release'))
a=p.parse_args();validate_url(a.url)
import re
if a.revision and not re.fullmatch(r'[0-9a-f]{40}',a.revision):p.error('Revision must be a 40-character commit SHA')
if a.channel=='experimental' and not a.revision:p.error('Experimental builds require a revision')
if a.archive_name and not re.fullmatch(r'[A-Za-z0-9._-]+\.zip',a.archive_name):p.error('Invalid archive filename')
out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
archive=out/(a.archive_name or f'MMSM-{__version__}-update.zip')
files=list((root/'mmsm').rglob('*'))+[root/'start.bat',root/'start.sh',root/'README.md']
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for file in sorted(files):
        if not file.is_file() or file.is_symlink() or '__pycache__' in file.parts:continue
        name=file.relative_to(root).as_posix();program_path(name)
        if name=='mmsm/__init__.py':
            content=file.read_text()
            content=re.sub(r'^__revision__ = .*$', '__revision__ = '+repr(a.revision),content,flags=re.M)
            content=re.sub(r'^__build_channel__ = .*$', '__build_channel__ = '+repr(a.channel),content,flags=re.M)
            z.writestr(name,content)
        else:z.write(file,name)
manifest={'version':__version__,'url':a.url,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest()}
if a.revision:manifest.update(revision=a.revision,channel=a.channel)
(out/'latest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(archive);print(out/'latest.json')
