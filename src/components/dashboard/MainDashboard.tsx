import React, { useState, useEffect } from 'react';
import {
  Server,
  Activity,
  Cpu,
  Database,
  Users,
  HardDrive,
  Play,
  Square,
  RotateCw,
  Skull,
  Plus,
  ArrowRight,
  Shield,
  Layers,
  Clock,
  Network,
  TrendingUp,
  Archive,
} from 'lucide-react';
import { useServer } from '../../context/ServerContext';
import { useAuth } from '../../context/AuthContext';
import { MinecraftServer } from '../../types/server';

interface MainDashboardProps {
  onSelectServer: (server: MinecraftServer) => void;
  onOpenCreateModal: () => void;
  onOpenLoaderUpdate: (server: MinecraftServer) => void;
}

export const MainDashboard: React.FC<MainDashboardProps> = ({
  onSelectServer,
  onOpenCreateModal,
}) => {
  const { servers, startServer, stopServer, restartServer, killServer, archiveServer, wakeServer } = useServer();
  const { canPerformAction } = useAuth();

  // Filter out archived servers
  const activeFleet = servers.filter((s) => !s.isArchived);

  // Aggregate host usage metrics
  const runningServers = activeFleet.filter((s) => s.status === 'online');
  const totalAllocatedRam = activeFleet.reduce((acc, s) => acc + s.allocatedRamMb, 0);
  const totalUsedRam = runningServers.reduce((acc, s) => acc + s.telemetry.ramUsedMb, 0);
  const totalOnlinePlayers = activeFleet.reduce(
    (acc, s) => acc + s.players.filter((p) => p.online).length,
    0
  );
  const totalCapacity = activeFleet.reduce((acc, s) => acc + s.properties.maxPlayers, 0);
  const avgCpu = runningServers.length > 0
    ? (runningServers.reduce((acc, s) => acc + s.telemetry.cpuPercent, 0) / runningServers.length).toFixed(1)
    : '0';

  // Network bandwidth calculations (in Mbps and MB/s)
  const totalNetInKb = runningServers.reduce((acc, s) => acc + s.telemetry.networkInKb, 0);
  const totalNetOutKb = runningServers.reduce((acc, s) => acc + s.telemetry.networkOutKb, 0);
  const totalKbps = (totalNetInKb + totalNetOutKb) * 8; // bits
  const totalMbps = (totalKbps / 1000).toFixed(2);
  const totalMBSec = ((totalNetInKb + totalNetOutKb) / 1024).toFixed(2);

  // Network history for smooth real-time telemetry graph
  const [netHistory, setNetHistory] = useState<number[]>([
    1.2, 1.8, 2.4, 2.1, 3.5, 2.9, 3.8, 3.2, 4.1, 3.6, 4.2, 3.9, 4.5, parseFloat(totalMbps) || 3.8,
  ]);

  useEffect(() => {
    const val = parseFloat(totalMbps) || (runningServers.length > 0 ? 2.5 : 0.1);
    setNetHistory((prev) => [...prev.slice(1), val]);
  }, [totalMbps, runningServers.length]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-emerald-500 shadow-md shadow-emerald-500/50';
      case 'starting':
      case 'stopping':
      case 'backing_up':
        return 'bg-amber-500 animate-pulse';
      case 'crashed':
        return 'bg-rose-500';
      default:
        return 'bg-zinc-600';
    }
  };

  // Sparkline renderer
  const renderSparkline = (data: number[], height: number = 70, strokeColor = '#10b981') => {
    const width = 400;
    const padding = 6;
    const max = Math.max(...data, 5);
    const min = Math.min(...data, 0);
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
        <defs>
          <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#netGrad)" />
        <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto w-full space-y-8 animate-in fade-in">
      {/* Welcome Banner & Host Summary */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40">
              Host Overview
            </span>
            <span className="text-zinc-500 text-xs font-mono">
              Debian 12 · OpenJDK 21
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-zinc-100 mt-1.5 tracking-tight">
            CraftyForge Server Fleet
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Global fleet management and cross-platform resource telemetry. Select any instance to view console or configure mods.
          </p>
        </div>

        {canPerformAction('manage_servers') && (
          <button
            onClick={onOpenCreateModal}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/50 flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Server</span>
          </button>
        )}
      </div>

      {/* OVERALL HOST USAGE CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Instances */}
        <div className="bg-[#11151c] border border-zinc-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase font-mono flex items-center gap-1.5">
              <Server className="w-4 h-4 text-emerald-400" />
              <span>Instances</span>
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 font-mono font-semibold">
              {runningServers.length} Active
            </span>
          </div>
          <div className="flex items-baseline gap-2 pt-1">
            <span className="text-3xl font-bold font-mono text-zinc-100">
              {runningServers.length}
            </span>
            <span className="text-xs text-zinc-500 font-mono">
              / {activeFleet.length} active fleet
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 font-mono pt-1">
            {activeFleet.length - runningServers.length} offline · {servers.filter((s) => s.isArchived).length} archived
          </p>
        </div>

        {/* Card 2: Total Memory Usage */}
        <div className="bg-[#11151c] border border-zinc-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase font-mono flex items-center gap-1.5">
              <Database className="w-4 h-4 text-emerald-400" />
              <span>RAM Allocated</span>
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 font-mono text-zinc-300 font-semibold">
              {totalAllocatedRam > 0 ? Math.round((totalUsedRam / totalAllocatedRam) * 100) : 0}%
            </span>
          </div>
          <div className="flex items-baseline gap-2 pt-1">
            <span className="text-3xl font-bold font-mono text-zinc-100">
              {(totalUsedRam / 1024).toFixed(1)}
            </span>
            <span className="text-xs text-zinc-500 font-mono">
              / {(totalAllocatedRam / 1024).toFixed(1)} GB Total
            </span>
          </div>
          <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden mt-1">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all"
              style={{
                width: `${totalAllocatedRam > 0 ? Math.min(100, (totalUsedRam / totalAllocatedRam) * 100) : 0}%`,
              }}
            />
          </div>
        </div>

        {/* Card 3: Host CPU Load */}
        <div className="bg-[#11151c] border border-zinc-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase font-mono flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span>Host CPU Avg</span>
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-400 border border-cyan-800/50 font-mono font-semibold">
              4 Cores
            </span>
          </div>
          <div className="flex items-baseline gap-2 pt-1">
            <span className="text-3xl font-bold font-mono text-zinc-100">{avgCpu}%</span>
            <span className="text-xs text-zinc-500 font-mono">processor load</span>
          </div>
          <p className="text-[11px] text-zinc-500 font-mono pt-1">
            Low-overhead asynchronous wrapper polling
          </p>
        </div>

        {/* Card 4: Network Players & Real-time Bandwidth (Requested: embedded in this box) */}
        <div className="bg-[#11151c] border border-zinc-800 rounded-2xl p-5 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400 uppercase font-mono flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Network Players</span>
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 font-mono font-semibold">
                Online
              </span>
            </div>
            <div className="flex items-baseline gap-2 pt-1">
              <span className="text-3xl font-bold font-mono text-emerald-400">
                {totalOnlinePlayers}
              </span>
              <span className="text-xs text-zinc-500 font-mono">
                / {totalCapacity} slots
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 font-mono">
              Active connections across fleet
            </p>
          </div>

          {/* Embedded Real-time Bandwidth Traffic Section */}
          <div className="pt-2 border-t border-zinc-800/80 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
              <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                <TrendingUp className="w-3 h-3" />
                <span>Live Traffic</span>
              </span>
              <span className="text-zinc-200 font-bold">{totalMbps} Mbps ({totalMBSec} MB/s)</span>
            </div>
            <div className="h-12 bg-zinc-950/60 rounded-lg p-1 border border-zinc-800/60 overflow-hidden">
              {renderSparkline(netHistory, 44, '#10b981')}
            </div>
          </div>
        </div>
      </div>

      {/* INDIVIDUAL SERVER FLEET CARDS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <span>Configured Servers ({activeFleet.length})</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {activeFleet.map((srv) => {
            const onlinePlayers = srv.players.filter((p) => p.online);
            const ramUsed = (srv.telemetry.ramUsedMb / 1024).toFixed(1);
            const ramMax = (srv.allocatedRamMb / 1024).toFixed(1);

            return (
              <div
                key={srv.id}
                className="bg-[#11151c] border border-zinc-800 hover:border-zinc-700 rounded-2xl p-5 flex flex-col justify-between space-y-4 transition-all shadow-xl group"
              >
                {/* Server Header */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        {srv.serverIconUrl ? (
                          <img
                            src={srv.serverIconUrl}
                            alt={srv.name}
                            className="w-10 h-10 rounded-xl border border-zinc-700 bg-zinc-800 object-contain p-0.5"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://api.iconify.design/pixelarticons:sword.svg';
                            }}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-emerald-400 font-bold text-xs">
                            MC
                          </div>
                        )}
                        <span
                          className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[#11151c] ${getStatusColor(
                            srv.status
                          )}`}
                        />
                      </div>

                      <div>
                        <h3 className="font-bold text-base text-zinc-100 group-hover:text-emerald-400 transition-colors">
                          {srv.name}
                        </h3>
                        <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                          Port: <span className="text-zinc-200 font-bold">{srv.port}</span> · {srv.loader.toUpperCase()} {srv.loaderVersion} (MC {srv.minecraftVersion})
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                    {srv.description}
                  </p>

                  {/* Telemetry Strip */}
                  <div className="grid grid-cols-3 gap-2 bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-800/80 text-center font-mono text-xs">
                    <div>
                      <span className="text-[10px] text-zinc-500 block uppercase">TPS</span>
                      <span
                        className={`font-semibold ${
                          srv.telemetry.tps >= 19.5 ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {srv.status === 'online' ? srv.telemetry.tps.toFixed(1) : '0.0'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-zinc-500 block uppercase">RAM</span>
                      <span className="font-semibold text-zinc-200">
                        {srv.status === 'online' ? `${ramUsed}G` : `0/${ramMax}G`}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-zinc-500 block uppercase">Players</span>
                      <span className="font-semibold text-emerald-400">
                        {onlinePlayers.length}/{srv.properties.maxPlayers}
                      </span>
                    </div>
                  </div>

                  {/* Online Player Skin Avatars */}
                  {onlinePlayers.length > 0 ? (
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-zinc-500 font-mono mr-1">Playing:</span>
                      {onlinePlayers.slice(0, 5).map((p) => (
                        <img
                          key={p.uuid}
                          src={`https://mc-heads.net/avatar/${p.username}/24`}
                          alt={p.username}
                          title={p.username}
                          className="w-5 h-5 rounded border border-zinc-700 bg-zinc-800"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'https://mc-heads.net/avatar/MHF_Steve/24';
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-zinc-500 font-mono pt-1">
                      <span>{srv.mods.length} mods / plugins · {srv.files?.length || 10} files</span>
                    </div>
                  )}
                </div>

                {/* Footer Controls: Start, Stop, Restart, Kill and Manage Server Button */}
                <div className="pt-3 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-2">
                  {/* Power Actions (Start, Restart, Stop, Kill, Wake) */}
                  {canPerformAction('server_power') && (
                    <div className="flex items-center gap-1">
                      {srv.status === 'sleeping' ? (
                        <button
                          onClick={() => wakeServer(srv.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40 text-xs font-semibold transition-colors cursor-pointer"
                          title="Wake server from standby hibernation"
                        >
                          <span>💤 Wake Server</span>
                        </button>
                      ) : srv.status === 'offline' ? (
                        <button
                          onClick={() => startServer(srv.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-600/30 text-xs font-semibold transition-colors cursor-pointer"
                          title="Start server process"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Start</span>
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => restartServer(srv.id)}
                            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-colors cursor-pointer"
                            title="Gracefully restart server"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => stopServer(srv.id)}
                            className="p-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-600/30 transition-colors cursor-pointer"
                            title="Gracefully stop server (/stop)"
                          >
                            <Square className="w-3.5 h-3.5 fill-current" />
                          </button>
                          <button
                            onClick={() => killServer(srv.id)}
                            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-rose-950/40 text-zinc-500 hover:text-rose-400 border border-zinc-800 transition-colors cursor-pointer"
                            title="Force Kill (SIGKILL)"
                          >
                            <Skull className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}

                      {/* Archive action (Greyed out when running with tooltip) */}
                      {srv.status === 'online' || srv.status === 'starting' ? (
                        <button
                          disabled
                          className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-600 opacity-40 cursor-not-allowed transition-colors"
                          title="Stop the server to make this change"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => archiveServer(srv.id)}
                          className="p-1.5 rounded-lg bg-zinc-900 hover:bg-amber-950/40 text-zinc-500 hover:text-amber-400 border border-zinc-800 transition-colors cursor-pointer"
                          title="Archive server (moves to Wrapper Settings vault)"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Primary Manage Button */}
                  <button
                    onClick={() => onSelectServer(srv)}
                    className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950/40 transition-colors cursor-pointer ml-auto"
                  >
                    <span>Manage Server</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
