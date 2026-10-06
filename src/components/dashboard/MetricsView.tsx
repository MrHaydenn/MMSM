import React, { useState, useEffect } from 'react';
import {
  Activity,
  Cpu,
  Database,
  HardDrive,
  Network,
  Clock,
  Zap,
  Server,
  Layers,
  Terminal,
} from 'lucide-react';
import { useServer } from '../../context/ServerContext';

export const MetricsView: React.FC = () => {
  const { activeServer } = useServer();
  const { telemetry } = activeServer;

  // Keep a 15-point historical telemetry trail for sparklines
  const [history, setHistory] = useState<{
    cpu: number[];
    ram: number[];
    tps: number[];
    netIn: number[];
    netOut: number[];
  }>({
    cpu: [12, 14, 18, 15, 20, 16, 14, 15, 13, 19, 14, 16, 15, 14, telemetry.cpuPercent],
    ram: [3200, 3250, 3300, 3320, 3340, 3380, 3400, 3390, 3410, 3410, 3420, 3400, 3410, 3410, telemetry.ramUsedMb],
    tps: [20.0, 20.0, 19.98, 20.0, 19.95, 20.0, 20.0, 20.0, 20.0, 19.98, 20.0, 20.0, 20.0, 20.0, telemetry.tps],
    netIn: [60, 72, 85, 90, 78, 65, 84, 88, 92, 80, 84, 82, 84, 85, telemetry.networkInKb],
    netOut: [180, 210, 220, 240, 205, 190, 215, 220, 225, 210, 218, 214, 218, 220, telemetry.networkOutKb],
  });

  useEffect(() => {
    if (activeServer.status !== 'online') return;

    setHistory((prev) => ({
      cpu: [...prev.cpu.slice(1), telemetry.cpuPercent],
      ram: [...prev.ram.slice(1), telemetry.ramUsedMb],
      tps: [...prev.tps.slice(1), telemetry.tps],
      netIn: [...prev.netIn.slice(1), telemetry.networkInKb],
      netOut: [...prev.netOut.slice(1), telemetry.networkOutKb],
    }));
  }, [telemetry.cpuPercent, telemetry.ramUsedMb, telemetry.tps, activeServer.status]);

  const formatUptime = (seconds: number) => {
    if (!seconds || seconds <= 0) return 'Offline';
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (d > 0) return `${d}d ${h}h ${m}m ${s}s`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  const ramPercent = Math.round((telemetry.ramUsedMb / activeServer.allocatedRamMb) * 100);
  const diskPercent = Math.round((telemetry.diskUsedMb / telemetry.diskTotalMb) * 100);

  // SVG sparkline generator
  const renderSparkline = (
    data: number[],
    min: number,
    max: number,
    color: string = '#10b981',
    fillColor: string = 'rgba(16, 185, 129, 0.15)'
  ) => {
    const width = 280;
    const height = 60;
    const padding = 5;
    const range = max - min || 1;

    const points = data.map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - padding - ((val - min) / range) * (height - padding * 2);
      return `${x},${Math.max(padding, Math.min(height - padding, y))}`;
    });

    const pathD = `M ${points.join(' L ')}`;
    const areaD = `${pathD} L ${width},${height} L 0,${height} Z`;

    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        <path d={areaD} fill={fillColor} />
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  };

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto w-full space-y-6">
      {/* Title */}
      <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            <span>Cross-Platform Resource Telemetry</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Real-time monitoring for {activeServer.name} · PID active · Low-overhead JMX & cgroups wrapper
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-zinc-400">Server Uptime:</span>
            <span className="font-mono font-semibold text-emerald-400">
              {formatUptime(telemetry.uptimeSeconds)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Server TPS */}
        <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase font-mono flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span>Tick Rate (TPS)</span>
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded font-mono font-bold ${
                telemetry.tps >= 19.5
                  ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50'
                  : 'bg-amber-950/60 text-amber-400 border border-amber-800/50'
              }`}
            >
              {telemetry.tps.toFixed(2)} / 20.0
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-zinc-100">
              {activeServer.status === 'online' ? telemetry.tps.toFixed(2) : '0.00'}
            </span>
            <span className="text-xs text-zinc-500 font-mono">
              ({telemetry.tickTimeMs}ms MSPT / 50ms)
            </span>
          </div>

          <div className="pt-2">
            {renderSparkline(history.tps, 18.0, 20.0, '#10b981', 'rgba(16, 185, 129, 0.15)')}
          </div>

          <p className="text-[11px] text-zinc-500 pt-1">Target 20.0 TPS (50ms per tick budget). Steady ticks mean zero entity lag.</p>
        </div>

        {/* Card 2: CPU Load */}
        <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase font-mono flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span>Host CPU Load</span>
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 font-mono text-cyan-400 font-semibold">
              4 Cores Active
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-zinc-100">
              {activeServer.status === 'online' ? `${telemetry.cpuPercent}%` : '0%'}
            </span>
            <span className="text-xs text-zinc-500 font-mono">
              Thread: Server thread
            </span>
          </div>

          <div className="pt-2">
            {renderSparkline(history.cpu, 0, 100, '#06b6d4', 'rgba(6, 182, 212, 0.15)')}
          </div>

          <p className="text-[11px] text-zinc-500 pt-1">Real-time JVM processor consumption across Minecraft workers.</p>
        </div>

        {/* Card 3: Memory / RAM */}
        <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase font-mono flex items-center gap-1.5">
              <Database className="w-4 h-4 text-emerald-400" />
              <span>Memory (RAM)</span>
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 font-mono text-emerald-400 font-semibold">
              {ramPercent}%
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-zinc-100">
              {activeServer.status === 'online'
                ? (telemetry.ramUsedMb / 1024).toFixed(1)
                : '0.0'}
            </span>
            <span className="text-xs text-zinc-500 font-mono">
              / {(activeServer.allocatedRamMb / 1024).toFixed(1)} GB Allocated
            </span>
          </div>

          <div className="pt-2">
            {renderSparkline(history.ram, activeServer.minRamMb, activeServer.allocatedRamMb, '#22c55e', 'rgba(34, 197, 94, 0.15)')}
          </div>

          <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                ramPercent > 85 ? 'bg-rose-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, ramPercent)}%` }}
            />
          </div>
        </div>

        {/* Card 4: Network I/O */}
        <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase font-mono flex items-center gap-1.5">
              <Network className="w-4 h-4 text-purple-400" />
              <span>Network Throughput</span>
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 font-mono text-purple-400 font-semibold">
              Port {activeServer.port}
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-zinc-100">
              {telemetry.networkOutKb}
            </span>
            <span className="text-xs text-zinc-500 font-mono">KB/s Out · {telemetry.networkInKb} KB/s In</span>
          </div>

          <div className="pt-2">
            {renderSparkline(history.netOut, 50, 400, '#a855f7', 'rgba(168, 85, 247, 0.15)')}
          </div>

          <p className="text-[11px] text-zinc-500 pt-1">Player packet synchronization, chunk packets & block state updates.</p>
        </div>
      </div>

      {/* Host Environment & JVM Specifications */}
      <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
          <Server className="w-4 h-4 text-emerald-400" />
          <span>Host System & Java Virtual Machine Configuration</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-mono">
          <div className="p-3 bg-zinc-900/80 rounded-lg border border-zinc-800/80 space-y-1">
            <span className="text-zinc-500 text-[10px] uppercase">Operating System</span>
            <p className="text-zinc-200 font-semibold">Debian GNU/Linux 12 (bookworm) x86_64</p>
            <p className="text-[11px] text-zinc-400">Kernel: 6.6.137+ / cgroups v2 enabled</p>
          </div>

          <div className="p-3 bg-zinc-900/80 rounded-lg border border-zinc-800/80 space-y-1">
            <span className="text-zinc-500 text-[10px] uppercase">Java Runtime</span>
            <p className="text-zinc-200 font-semibold">{activeServer.javaVersion}</p>
            <p className="text-[11px] text-zinc-400">Garbage Collector: G1GC (Low latency)</p>
          </div>

          <div className="p-3 bg-zinc-900/80 rounded-lg border border-zinc-800/80 space-y-1">
            <span className="text-zinc-500 text-[10px] uppercase">Storage Space</span>
            <p className="text-zinc-200 font-semibold">
              {(telemetry.diskUsedMb / 1024).toFixed(1)} GB Used / {(telemetry.diskTotalMb / 1024).toFixed(0)} GB SSD
            </p>
            <div className="w-full bg-zinc-800 h-1 rounded-full mt-2 overflow-hidden">
              <div className="bg-emerald-500 h-full" style={{ width: `${diskPercent}%` }} />
            </div>
          </div>
        </div>

        {/* JVM Flags snippet */}
        <div className="p-3 bg-[#0a0d12] rounded-lg border border-zinc-800/80 space-y-1.5 font-mono text-[11px]">
          <div className="flex items-center justify-between text-zinc-500">
            <span>STARTUP JVM ARGUMENTS (Aikar's Optimized Flags)</span>
            <span className="text-emerald-400">Auto-tuned</span>
          </div>
          <code className="text-zinc-300 block overflow-x-auto whitespace-pre py-1">
            java -Xms{activeServer.minRamMb}M -Xmx{activeServer.allocatedRamMb}M -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1ReservePercent=20 -jar server.jar nogui
          </code>
        </div>
      </div>
    </div>
  );
};
