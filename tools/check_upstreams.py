#!/usr/bin/env python3
"""Read-only upstream smoke checks. Does not download/launch a Minecraft server."""
import argparse
import json
from pathlib import Path
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mmsm.store import Store
from mmsm.providers import Providers

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--contact', required=True, help='Your contact URL/email, required by Paper')
args = parser.parse_args()
failed = False
with tempfile.TemporaryDirectory(prefix='mmsm-upstreams-') as directory:
    store = Store(directory)
    store.set_settings({'upstream_contact': args.contact})
    providers = Providers(store)
    for loader in ('vanilla','fabric','forge','neoforge','paper'):
        try:
            catalog = providers.catalog(loader)
            minecraft = catalog['minecraft'][0]
            versions = providers.catalog(loader, minecraft)['versions']
            assert versions, 'No loader versions returned'
            print(json.dumps({'provider':loader, 'ok':True, 'minecraft':minecraft, 'loader_versions':len(versions)}),flush=True)
        except Exception as e:
            failed = True
            print(json.dumps({'provider':loader, 'ok':False, 'error':str(e)}),flush=True)
    try:
        results = providers.search('fabric api','fabric',None,'mod')
        assert results['hits'], 'No Modrinth results returned'
        print(json.dumps({'provider':'modrinth','ok':True,'hits':len(results['hits'])}),flush=True)
    except Exception as e:
        failed = True
        print(json.dumps({'provider':'modrinth','ok':False,'error':str(e)}),flush=True)
    store.db.close()
sys.exit(1 if failed else 0)
