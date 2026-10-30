"""Parse editable JVM options and keep heap settings canonical."""
import re
import shlex
from .store import require


def tokens(value):
    if isinstance(value, str):
        require(len(value) <= 16384, 'JVM arguments are too long')
        try: value = shlex.split(value)
        except ValueError as exc: raise ValueError('Invalid JVM argument quoting: ' + str(exc))
    require(isinstance(value, list) and len(value) <= 256 and all(isinstance(x,str) and x and len(x)<=4096 and not any(c in x for c in '\x00\r\n') for x in value), 'Invalid JVM arguments')
    return value


def heap_mb(value):
    match = re.fullmatch(r'(\d+)([kKmMgG]?)', value)
    require(match, 'Heap sizes must use a whole number with K, M or G, such as -Xmx8G')
    size=int(match[1])*{'':1,'k':1024,'m':1024**2,'g':1024**3}[match[2].lower()]
    require(size>0 and size%(1024**2)==0,'Heap sizes must be a positive whole number of MB')
    return size//(1024**2)


def normalize(value, memory_mb, explicit_memory=False, initial_mb=512):
    options=[]; maximum=None; initial=None; operand=False
    paired={'--add-opens','--add-exports','--add-reads','--add-modules','--enable-native-access'}
    blocked={'-jar','-cp','-classpath','--class-path','-m','--module','--module-path','-p','--source','--','-version','--version','-help','--help','-?','-h'}
    for arg in tokens(value):
        if operand:
            require(not arg.startswith(('@','-')), 'Missing value for JVM option')
            options.append(arg);operand=False;continue
        if arg.startswith('-Xmx'): maximum=heap_mb(arg[4:]);continue
        if arg.startswith('-Xms'): initial=heap_mb(arg[4:]);continue
        require(arg.startswith('-') and arg.split('=',1)[0] not in blocked and not arg.startswith('-XX:Flags=') and not re.match(r'-XX:(?:MaxHeapSize|InitialHeapSize|(?:Max|Min|Initial)RAM(?:Percentage|Fraction)?)(?:=|$)',arg), 'Use JVM options only; heap sizes use -Xms/-Xmx and the RAM control. Loader/main-class/argument-file overrides are managed by MMSM.')
        options.append(arg);operand=arg in paired
    require(not operand, 'Missing value for JVM option')
    if maximum is not None:
        require(not explicit_memory or maximum==memory_mb,'-Xmx conflicts with the RAM field; make their values match')
        memory_mb=maximum
    require(type(memory_mb) is int and 512<=memory_mb<=262144,'Memory must be 0.5–256 GB')
    initial_mb=initial if initial is not None else min(initial_mb,memory_mb)
    require(0<initial_mb<=memory_mb,'-Xms must not exceed -Xmx / memory allocation')
    return options,memory_mb,initial_mb


def effective(server):
    options,memory,initial=normalize(server.get('jvm_args',[]),server['memory_mb'],initial_mb=server.get('initial_memory_mb',512))
    return [f'-Xms{initial}M',f'-Xmx{memory}M',*options]
