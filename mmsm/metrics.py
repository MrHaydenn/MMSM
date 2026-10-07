import os
from pathlib import Path
import time

try:
    import psutil
except ImportError:
    psutil = None


class Sampler:
    def __init__(self):
        self.previous = {}
        self.cpu_previous = None
        self.net_previous = None
        self.proc_previous = {}
        self.last = time.monotonic()
        self.ps_processes = {}

    def host(self):
        now = time.monotonic()
        dt = max(now - self.last, 0.001)
        self.last = now
        if psutil:
            mem = psutil.virtual_memory()
            net = psutil.net_io_counters()
            totals = (net.bytes_recv, net.bytes_sent)
            cpu = psutil.cpu_percent()
            total, used = mem.total, mem.total - mem.available
        elif Path('/proc/stat').exists():
            ticks = [int(x) for x in Path('/proc/stat').read_text().splitlines()[0].split()[1:9]]
            total_ticks, idle = sum(ticks), ticks[3] + ticks[4]
            cpu = None
            if self.cpu_previous:
                dtotal = total_ticks - self.cpu_previous[0]
                cpu = 100 * (1 - (idle - self.cpu_previous[1]) / dtotal) if dtotal else 0
            self.cpu_previous = (total_ticks, idle)
            mem = {line.split(':')[0]: int(line.split()[1]) * 1024 for line in Path('/proc/meminfo').read_text().splitlines()}
            total, used = mem['MemTotal'], mem['MemTotal'] - mem['MemAvailable']
            totals = [0, 0]
            for line in Path('/proc/net/dev').read_text().splitlines()[2:]:
                name, data = line.split(':')
                if name.strip() == 'lo':
                    continue
                fields = data.split()
                totals[0] += int(fields[0]); totals[1] += int(fields[8])
        else:
            return {'cpu': None, 'ram_total': None, 'ram_used': None, 'rx_rate': None, 'tx_rate': None,
                    'note': 'Install psutil for host telemetry on this platform', 'dt': dt}
        rates = [None, None] if not self.net_previous else [max(0, (totals[i] - self.net_previous[i]) / dt) for i in (0, 1)]
        self.net_previous = totals
        return {'cpu': cpu, 'ram_total': total, 'ram_used': used, 'rx_rate': rates[0], 'tx_rate': rates[1], 'dt': dt}

    def process(self, pid, dt):
        if psutil:
            try:
                proc = self.ps_processes.setdefault(pid, psutil.Process(pid))
                return proc.cpu_percent() / (os.cpu_count() or 1), proc.memory_info().rss
            except psutil.Error:
                return 0, 0
        try:
            fields = Path(f'/proc/{pid}/stat').read_text().rsplit(')', 1)[1].split()
            ticks = int(fields[11]) + int(fields[12])
            old = self.proc_previous.get(pid, ticks)
            self.proc_previous[pid] = ticks
            cpu = max(0, ticks - old) / os.sysconf('SC_CLK_TCK') / dt / (os.cpu_count() or 1) * 100
            rss = int(fields[21]) * os.sysconf('SC_PAGE_SIZE')
            return cpu, rss
        except (OSError, ValueError, IndexError):
            return None, None
