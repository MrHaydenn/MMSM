"""Persisted listener/public-origin settings shared by startup and the WebGUI."""
from urllib.parse import urlsplit
from .store import require

def public_origin(value):
    require(isinstance(value,str) and len(value)<=2048,'Invalid public URL')
    value=value.strip()
    if not value:return ''
    try:
        parsed=urlsplit(value)
        valid=(parsed.scheme in ('http','https') and parsed.hostname and parsed.netloc and
               not parsed.username and not parsed.password and parsed.path in ('','/') and
               not parsed.query and not parsed.fragment and not any(c.isspace() for c in value) and
               '\\' not in value and parsed.port != 0)
    except ValueError:valid=False
    require(valid,'Public URL must be an HTTP(S) origin, e.g. https://mmsm.example.com, without a path')
    host=parsed.hostname.lower()
    if ':' in host:host='['+host+']'
    port=parsed.port
    suffix=':'+str(port) if port and port != (443 if parsed.scheme=='https' else 80) else ''
    return parsed.scheme+'://'+host+suffix

def startup_network(settings,host=None,origin=None):
    return host or settings['bind_host'], public_origin(origin if origin is not None else settings['public_origin']) or None
