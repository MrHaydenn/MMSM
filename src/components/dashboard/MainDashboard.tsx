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
  Copy,
  Check,
  Globe,
  Wifi,
  BarChart3,
  Calendar,
  AlertTriangle,
  X,
  Pencil,
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
  const {
    servers,
    startServer,
    stopServer,
    restartServer,
    killServer,
    archiveServer,
    wakeServer,
    wrapperSettings,
    setServerPublicIp,
  } = useServer();
  const { canPerformAction } = useAuth();

  const [copiedIpServerId, setCopiedIpServerId] = useState<string | null>(null);
  const [archiveModalServer, setArchiveModalServer] = useState<MinecraftServer | null>(null);
  const [editingIpServer, setEditingIpServer] = useState<MinecraftServer | null>(null);
  const [customIpInput, setCustomIpInput] = useState('');
  const [customPortInput, setCustomPortInput] = useState('');
  const [hidePortInput, setHidePortInput] = useState(false);
  const [analyticsTimeframe, setAnalyticsTimeframe] = useState<'7d' | '30d'>('30d');

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

  // Total backups storage volume across all active and archived servers
  const totalBackupsSizeMb = servers.reduce(
    (acc, s) => acc + (s.backups || []).reduce((bAcc, b) => bAcc + b.sizeBytes, 0),
    0
  ) / 1048576;

  // Network history for smooth real-time telemetry graph
  const [netHistory, setNetHistory] = useState<number[]>([
    1.2, 1.8, 2.4, 2.1, 3.5, 2.9, 3.8, 3.2, 4.1, 3.6, 4.2, 3.9, 4.5, parseFloat(totalMbps) || 3.8,
  ]);

  useEffect(() => {
    const val = parseFloat(totalMbps) || (runningServers.length > 0 ? 2.5 : 0.1);
    setNetHistory((prev) => [...prev.slice(1), val]);
  }, [totalMbps, runningServers.length]);

  const handleCopyIp = (srv: MinecraftServer, e: React.MouseEvent) => {
    e.stopPropagation();
    const effectiveIp = srv.publicServerIp || wrapperSettings.publicIp || 'localhost';
    const effectivePort = srv.publicServerPort !== undefined && srv.publicServerPort !== '' ? srv.publicServerPort : srv.port;
    const connectionAddress = srv.hidePublicPort ? effectiveIp : `${effectiveIp}:${effectivePort}`;
    navigator.clipboard.writeText(connectionAddress);
    setCopiedIpServerId(srv.id);
    setTimeout(() => setCopiedIpServerId(null), 2500);
  };

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
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto w-full space-y-7 animate-in fade-in">
      {/* Top Action & Compact Host Status (Title & Description removed for maximum space) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <span className="text-[11px] uppercase tracking-wider text-emerald-400 font-bold px-2.5 py-1 rounded-lg bg-emerald-950/70 border border-emerald-800/50">
            Host: Linux Debian x86_64
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">
            {runningServers.length} / {activeFleet.length} Online
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400">
            Public IP: <strong className="text-zinc-200">{wrapperSettings.publicIp || 'Not configured'}</strong>
          </span>
        </div>

        {canPerformAction('manage_servers') && (
          <button
            onClick={onOpenCreateModal}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/50 flex items-center gap-2 transition-colors cursor-pointer"
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

        {/* Card 4: Network Players & Real-time Bandwidth */}
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

            const effectiveIp = srv.publicServerIp || wrapperSettings.publicIp || 'localhost';
            const effectivePort = srv.publicServerPort !== undefined && srv.publicServerPort !== '' ? srv.publicServerPort : srv.port;
            const serverAddress = srv.hidePublicPort ? effectiveIp : `${effectiveIp}:${effectivePort}`;
            const isOnline = srv.status === 'online';

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

                      <div
                        onClick={() => onSelectServer(srv)}
                        className="cursor-pointer"
                        title="Manage this server"
                      >
                        <h3 className="font-bold text-base text-zinc-100 group-hover:text-emerald-400 hover:underline transition-colors flex items-center gap-1.5">
                          <span>{srv.name}</span>
                        </h3>
                        <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                          Port: <span className="text-zinc-200 font-bold">{srv.port}</span> · {srv.loader.toUpperCase()} {srv.loaderVersion} (MC {srv.minecraftVersion})
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Public Connection Address Bar */}
                  <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-900/90 border border-zinc-800/80 text-xs font-mono">
                    <div className="flex items-center gap-1.5 text-zinc-300 truncate">
                      <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">{serverAddress}</span>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0 ml-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingIpServer(srv);
                          setCustomIpInput(srv.publicServerIp || '');
                          setCustomPortInput(srv.publicServerPort !== undefined ? String(srv.publicServerPort) : '');
                          setHidePortInput(!!srv.hidePublicPort);
                        }}
                        className="p-1 text-zinc-400 hover:text-emerald-400 rounded hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="Edit custom join domain/IP and display port for this server"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => handleCopyIp(srv, e)}
                        className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="Copy connection IP:port"
                      >
                        {copiedIpServerId === srv.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Telemetry Strip */}
                  <div className="grid grid-cols-3 gap-2 bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-800/80 text-center font-mono text-xs">
                    <div>
                      <span className="text-[10px] text-zinc-500 block uppercase">TPS</span>
                      <span
                        className={`font-semibold ${
                          srv.telemetry.tps >= 19.5 ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {isOnline ? srv.telemetry.tps.toFixed(1) : '0.0'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-zinc-500 block uppercase">RAM</span>
                      <span className="font-semibold text-zinc-200">
                        {isOnline ? `${ramUsed}G` : `0/${ramMax}G`}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-zinc-500 block uppercase">Players</span>
                      <span className="font-semibold text-emerald-400">
                        {onlinePlayers.length}/{srv.properties.maxPlayers}
                      </span>
                    </div>
                  </div>

                  {/* Individual Server Networking Rates */}
                  <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-900/50 border border-zinc-800/60 text-[11px] font-mono text-zinc-400">
                    <span className="flex items-center gap-1">
                      <Wifi className="w-3 h-3 text-emerald-400" />
                      <span>Network I/O:</span>
                    </span>
                    <span className="text-zinc-200">
                      {isOnline ? (
                        <>
                          <span className="text-emerald-400 font-semibold">↓ {(srv.telemetry.networkInKb).toFixed(1)} KB/s</span>{' '}
                          <span className="text-cyan-400 font-semibold">↑ {(srv.telemetry.networkOutKb).toFixed(1)} KB/s</span>
                        </>
                      ) : (
                        <span className="text-zinc-600">0.0 KB/s</span>
                      )}
                    </span>
                  </div>

                  {/* Online Player Skin Avatars */}
                  {onlinePlayers.length > 0 && (
                    <div className="flex items-center gap-1.5 pt-0.5">
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

                      {/* Archive action with confirmation prompt */}
                      {srv.status === 'online' || srv.status === 'starting' ? (
                        <button
                          disabled
                          className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-600 opacity-40 cursor-not-allowed transition-colors"
                          title="Stop the server to archive it"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => setArchiveModalServer(srv)}
                          className="p-1.5 rounded-lg bg-zinc-900 hover:bg-amber-950/40 text-zinc-500 hover:text-amber-400 border border-zinc-800 transition-colors cursor-pointer"
                          title="Archive server"
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

      {/* OVERALL SYSTEM ANALYTICS SECTION (Below Servers List) */}
      <div className="bg-[#11151c] border border-zinc-800 rounded-2xl p-6 space-y-6 pt-7">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <span>Fleet System Analytics</span>
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                  Global Metrics
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Aggregated 30-day host bandwidth, player concurrency peaks, uptime reliability, and disk utilization.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800 text-xs font-medium">
            <button
              onClick={() => setAnalyticsTimeframe('7d')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                analyticsTimeframe === '7d'
                  ? 'bg-zinc-800 text-emerald-400 font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => setAnalyticsTimeframe('30d')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                analyticsTimeframe === '30d'
                  ? 'bg-zinc-800 text-emerald-400 font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Last 30 Days
            </button>
          </div>
        </div>

        {/* Analytics Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 space-y-1">
            <span className="text-[11px] text-zinc-500 uppercase font-mono block">
              Total Bandwidth ({analyticsTimeframe === '30d' ? '30 Days' : '7 Days'})
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-emerald-400">
                {analyticsTimeframe === '30d' ? '148.4 GB' : '34.6 GB'}
              </span>
              <span className="text-xs text-zinc-400 font-mono">transfer</span>
            </div>
            <p className="text-[11px] text-zinc-500 font-mono pt-1">
              ↓ {analyticsTimeframe === '30d' ? '42.1 GB In' : '9.8 GB In'} · ↑ {analyticsTimeframe === '30d' ? '106.3 GB Out' : '24.8 GB Out'}
            </p>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 space-y-1">
            <span className="text-[11px] text-zinc-500 uppercase font-mono block">Peak Player Concurrency</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-zinc-100">
                {analyticsTimeframe === '30d' ? '18 Players' : '14 Players'}
              </span>
              <span className="text-xs text-zinc-400 font-mono">simultaneous</span>
            </div>
            <p className="text-[11px] text-zinc-500 font-mono pt-1">
              Peak time: Saturday 20:00 - 23:00 UTC
            </p>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 space-y-1">
            <span className="text-[11px] text-zinc-500 uppercase font-mono block">Fleet Uptime SLA</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-emerald-400">99.98%</span>
              <span className="text-xs text-zinc-400 font-mono">operational</span>
            </div>
            <p className="text-[11px] text-zinc-500 font-mono pt-1">
              0 unexpected crashes logged
            </p>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 space-y-1">
            <span className="text-[11px] text-zinc-500 uppercase font-mono block">Backup Archives Volume</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-cyan-400">
                {totalBackupsSizeMb >= 1024
                  ? `${(totalBackupsSizeMb / 1024).toFixed(2)} GB`
                  : `${Math.round(totalBackupsSizeMb)} MB`}
              </span>
              <span className="text-xs text-zinc-400 font-mono">stored</span>
            </div>
            <p className="text-[11px] text-zinc-500 font-mono pt-1">
              Across all configured server backup rules
            </p>
          </div>
        </div>

        {/* Historical Bandwidth Bar Visualizer */}
        <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
            <span className="font-semibold text-zinc-200">Daily Fleet Traffic Distribution (GB / Day)</span>
            <span>Average: {analyticsTimeframe === '30d' ? '4.95 GB/day' : '4.94 GB/day'}</span>
          </div>

          <div className="grid grid-cols-7 sm:grid-cols-14 lg:grid-cols-28 gap-1.5 h-20 items-end pt-2">
            {(analyticsTimeframe === '30d'
              ? [3.2, 4.1, 5.0, 4.8, 6.2, 7.8, 6.9, 4.0, 3.8, 5.1, 4.9, 6.4, 8.1, 7.2, 3.9, 4.4, 5.2, 4.7, 6.8, 7.9, 7.0, 4.2, 4.6, 5.5, 5.0, 6.9, 8.4, 7.5]
              : [4.2, 4.6, 5.5, 5.0, 6.9, 8.4, 7.5]
            ).map((val, idx) => (
              <div
                key={idx}
                className="bg-emerald-500/40 hover:bg-emerald-400 rounded-t transition-all cursor-pointer relative group flex flex-col justify-end"
                style={{ height: `${(val / 9) * 100}%` }}
                title={`Day ${idx + 1}: ${val} GB transferred`}
              >
                <div className="hidden group-hover:block absolute bottom-full mb-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-[9px] font-mono text-emerald-300 z-10 whitespace-nowrap shadow-lg">
                  {val} GB
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* EDIT CUSTOM SERVER IP MODAL */}
      {editingIpServer && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#11151c] border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-emerald-400">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-100">Server Connection Domain / IP</h3>
                  <p className="text-xs text-zinc-400">{editingIpServer.name} · Port :{editingIpServer.port}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingIpServer(null)}
                className="p-1 rounded-lg text-zinc-500 hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5 text-xs">
                <label className="text-zinc-300 font-semibold block">Custom Public Domain / Hostname</label>
                <input
                  type="text"
                  placeholder={`e.g. play.mydomain.com or leave blank to default`}
                  value={customIpInput}
                  onChange={(e) => setCustomIpInput(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-mono focus:outline-none focus:border-emerald-500 text-xs"
                />
              </div>

              {/* Display Port Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1.5">
                  <label className="text-zinc-300 font-semibold block flex items-center justify-between">
                    <span>Display Port Override</span>
                    <span className="text-[10px] text-zinc-500 font-mono">Optional</span>
                  </label>
                  <input
                    type="text"
                    placeholder={`e.g. 25565 or leave blank`}
                    value={customPortInput}
                    onChange={(e) => setCustomPortInput(e.target.value)}
                    disabled={hidePortInput}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-mono focus:outline-none focus:border-emerald-500 text-xs disabled:opacity-40"
                  />
                </div>

                <div className="space-y-1.5 flex flex-col justify-end">
                  <label className="flex items-center gap-2 p-2 bg-zinc-900/90 border border-zinc-800 rounded-xl cursor-pointer hover:bg-zinc-900 transition-colors">
                    <input
                      type="checkbox"
                      checked={hidePortInput}
                      onChange={(e) => setHidePortInput(e.target.checked)}
                      className="accent-emerald-500 rounded w-4 h-4 cursor-pointer"
                    />
                    <div className="text-[11px] leading-tight">
                      <span className="font-semibold text-zinc-200 block">Hide Port Completely</span>
                      <span className="text-zinc-500 text-[10px]">For SRV records / clean domains</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Live Preview Card */}
              <div className="p-3.5 bg-zinc-900/80 rounded-xl border border-zinc-800 space-y-1.5 text-xs text-zinc-400">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-400">Card Connection Badge Preview:</span>
                  <span className="text-emerald-400 font-mono font-bold text-xs bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-800">
                    {hidePortInput
                      ? (customIpInput.trim() || wrapperSettings.publicIp || 'localhost')
                      : `${customIpInput.trim() || wrapperSettings.publicIp || 'localhost'}:${customPortInput.trim() || editingIpServer.port}`}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500">
                  The actual server JVM will continue listening on port <strong className="text-zinc-300 font-mono">:{editingIpServer.port}</strong>. This custom domain and display port are purely visual for your players.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setCustomIpInput('');
                  setCustomPortInput('');
                  setHidePortInput(false);
                }}
                className="text-[11px] text-zinc-400 hover:text-zinc-200 cursor-pointer underline"
              >
                Reset to Default
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingIpServer(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold border border-zinc-800 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setServerPublicIp(
                      editingIpServer.id,
                      customIpInput.trim() || undefined,
                      customPortInput.trim() || undefined,
                      hidePortInput
                    );
                    setEditingIpServer(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/40 cursor-pointer transition-colors"
                >
                  Save Connection Address
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL FOR ARCHIVING SERVER */}
      {archiveModalServer && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#11151c] border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <Archive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-100">Archive Server?</h3>
                <p className="text-xs text-zinc-400">Instance dormancy confirmation</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Are you sure you want to archive <strong className="text-white font-mono">{archiveModalServer.name}</strong>?
              The server will be kept offline and moved to the Wrapper Settings vault. You can unarchive and restore it at any time without losing files.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setArchiveModalServer(null)}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold border border-zinc-800 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  archiveServer(archiveModalServer.id);
                  setArchiveModalServer(null);
                }}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-950/40 cursor-pointer transition-colors"
              >
                Confirm Archive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

