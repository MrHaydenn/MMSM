"""Bounded image decoding and cached Minecraft head rendering."""
import base64
import io
import json
import re
import time
import warnings
from urllib.parse import urlparse
from .store import require, Problem, atomic_write


def image_bytes(data, size=64, face=False):
    try:
        from PIL import Image, ImageOps
    except ImportError:raise Problem('Image support needs Pillow. Restart MMSM to retry automatic dependency installation.',503)
    require(isinstance(data,bytes) and 0<len(data)<=8*1024**2,'Images must be at most 8 MB')
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error',Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as source:
                require(source.width*source.height<=16_000_000,'Image is too large')
                source=ImageOps.exif_transpose(source).convert('RGBA')
                if face:
                    require(source.size in ((64,64),(64,32)),'Invalid Minecraft skin dimensions')
                    head=source.crop((8,8,16,16));head.alpha_composite(source.crop((40,8,48,16)))
                    source=head.resize((size,size),Image.Resampling.NEAREST)
                else:source=ImageOps.fit(source,(size,size),method=Image.Resampling.LANCZOS)
                out=io.BytesIO();source.save(out,format='PNG');return out.getvalue()
    except Problem:raise
    except Exception as e:raise Problem('Unable to decode this image. Upload a PNG, JPEG or WebP image.') from e


def minecraft_head(manager,name):
    require(re.fullmatch(r'[A-Za-z0-9_]{1,16}',name),'Invalid Minecraft username')
    cache=manager.store.root/'images'/'heads'/(name.lower()+'.png')
    if cache.is_file() and time.time()-cache.stat().st_mtime<86400:return cache.read_bytes()
    profile=manager.providers.get('https://api.mojang.com/users/profiles/minecraft/'+name)
    ident=profile.get('id','');require(re.fullmatch(r'[0-9a-fA-F]{32}',ident),'Minecraft account not found',404)
    session=manager.providers.get('https://sessionserver.mojang.com/session/minecraft/profile/'+ident)
    props=next((p['value'] for p in session.get('properties',[]) if p.get('name')=='textures'),None)
    require(props,'No skin is available for this player',404)
    texture=json.loads(base64.b64decode(props))['textures'].get('SKIN',{}).get('url','')
    parsed=urlparse(texture)
    require(parsed.hostname=='textures.minecraft.net' and re.fullmatch(r'/texture/[a-fA-F0-9]+',parsed.path),'Invalid skin URL')
    raw=manager.providers.get('https://textures.minecraft.net'+parsed.path,raw=True)
    png=image_bytes(raw,64,True);atomic_write(cache,png);return png
