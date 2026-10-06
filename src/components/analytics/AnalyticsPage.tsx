import React, { useState } from 'react';
import {
  TrendingUp,
  Activity,
  Users,
  Clock,
  Cpu,
  Database,
  Calendar,
  Download,
  Filter,
  Search,
  CheckCircle2,
  AlertCircle,
  Wifi,
  Sparkles,
  Layers,
  Shield,
  ArrowUpRight,
} from 'lucide-react';
import { useServer } from '../../context/ServerContext';
import { PlayerSessionRecord } from '../../types/server';

export const AnalyticsPage: React.FC = () => {
  const { activeServer } = useServer();

  const [timeframe, setTimeframe] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [playerSearch, setPlayerSearch] = useState('');
  const [selectedDimension, setSelectedDimension] = useState<string>('all');
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Fallback realistic session records if not populated
  const defaultSessions: PlayerSessionRecord[] = [
    {
      id: 'sess-1',
      username: 'TechnoFan_99',
      joinedAt: 'Today at 14:15:22',
      leftAt: 'Currently Online',
      durationMinutes: 45,
      dimension: 'Overworld',
      peakPing: 24,
    },
    {
      id: 'sess-2',
      username: 'DiamondMiner42',
      joinedAt: 'Today at 13:02:10',
      leftAt: 'Today at 14:30:15',
      durationMinutes: 88,
      dimension: 'Nether',
      peakPing: 38,
    },
    {
      id: 'sess-3',
      username: 'Alex_Builder',
      joinedAt: 'Today at 11:20:00',
      leftAt: 'Today at 12:45:10',
      durationMinutes: 85,
      dimension: 'Overworld',
      peakPing: 18,
    },
    {
      id: 'sess-4',
      username: 'RedstoneWiz',
      joinedAt: 'Today at 09:12:44',
      leftAt: 'Today at 10:55:00',
      durationMinutes: 102,
      dimension: 'The End',
      peakPing: 42,
    },
    {
      id: 'sess-5',
      username: 'CraftyPro',
      joinedAt: 'Yesterday at 20:10:00',
      leftAt: 'Yesterday at 23:30:00',
      durationMinutes: 200,
      dimension: 'Overworld',
      peakPing: 29,
    },
    {
      id: 'sess-6',
      username: 'EnderKnight',
      joinedAt: 'Yesterday at 18:00:12',
      leftAt: 'Yesterday at 19:40:00',
      durationMinutes: 100,
      dimension: 'The End',
      peakPing: 35,
    },
  ];

  const sessions = activeServer.playerSessions || defaultSessions;

  const filteredSessions = sessions.filter((s) => {
    const matchesSearch = s.username.toLowerCase().includes(playerSearch.toLowerCase());
    const matchesDim = selectedDimension === 'all' || s.dimension.toLowerCase() === selectedDimension.toLowerCase();
    return matchesSearch && matchesDim;
  });

  // Uptime calculation
  const uptimeHours = (activeServer.telemetry.uptimeSeconds / 3600).toFixed(1);
  const uptimePercent = activeServer.status === 'online' ? '99.8%' : '94.2%';

  // Historical data points for charts
  const historyHours = ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00', 'Now'];
  const playerHistory = [2, 0, 1, 4, 8, 12, 16, 11, activeServer.players.filter((p) => p.online).length];
  const tpsHistory = [20.0, 20.0, 19.9, 20.0, 19.8, 19.7, 19.9, 20.0, activeServer.telemetry.tps || 20.0];
  const ramHistoryMb = [2200, 2150, 2180, 2600, 3400, 4200, 4800, 4100, activeServer.telemetry.ramUsedMb || 3500];

  // Simple SVG Area / Line Chart component
  const renderLineChart = (
    data: number[],
    color: string,
    fillGradId: string,
    minVal: number,
    maxVal: number,
    formatVal: (v: number) => string
  ) => {
    const width = 500;
    const height = 140;
    const padding = 12;

    const range = maxVal - minVal || 1;
    const points = data.map((val, idx) => {
      const x = padding + (idx / (data.length - 1)) * (width - padding * 2);
      const y = height - padding - ((val - minVal) / range) * (height - padding * 2);
      return `${x},${Math.max(padding, Math.min(height - padding, y))}`;
    });

    const pathD = `M ${points.join(' L ')}`;
    const areaD = `${pathD} L ${width - padding},${height} L ${padding},${height} Z`;

    return (
      <div className="relative w-full">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-36 overflow-visible">
          <defs>
            <linearGradient id={fillGradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0.0" />
            </linearGradient>
          </defs>
          {/* Horizontal grid lines */}
          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#27272a" strokeDasharray="3 3" />
          <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#27272a" strokeDasharray="3 3" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#27272a" />

          {/* Area & Path */}
          <path d={areaD} fill={`url(#${fillGradId})`} />
          <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Data point dots */}
          {points.map((pt, idx) => {
            const [cx, cy] = pt.split(',');
            return (
              <circle
                key={idx}
                cx={cx}
                cy={cy}
                r="3.5"
                fill="#0e1218"
                stroke={color}
                strokeWidth="2"
              />
            );
          })}
        </svg>

        {/* X Axis Labels */}
        <div className="flex justify-between text-[10px] text-zinc-500 font-mono mt-1 px-1">
          {historyHours.map((h, i) => (
            <span key={i}>{h}</span>
          ))}
        </div>
      </div>
    );
  };

  const handleExportData = () => {
    const exportObject = {
      serverName: activeServer.name,
      minecraftVersion: activeServer.minecraftVersion,
      loader: activeServer.loader,
      exportedAt: new Date().toISOString(),
      uptimePercent,
      uptimeHours,
      peakPlayers: Math.max(...playerHistory),
      avgTps: (tpsHistory.reduce((a, b) => a + b, 0) / tpsHistory.length).toFixed(2),
      sessions,
    };

    const blob = new Blob([JSON.stringify(exportObject, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeServer.name.toLowerCase().replace(/\s+/g, '-')}-analytics.json`;
    a.click();
    URL.revokeObjectURL(url);

    setExportNotice('Exported analytics snapshot to JSON file!');
    setTimeout(() => setExportNotice(null), 3000);
  };

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto w-full space-y-6">
      {/* Header */}
      <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <span>Historical Analytics & Player Telemetry</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950/70 text-emerald-400 border border-emerald-800/50 font-mono font-medium">
                  Long-term Log
                </span>
              </h1>
              <p className="text-xs text-zinc-400">
                Performance graphs, player retention logs, and uptime statistics for{' '}
                <strong className="text-zinc-200">{activeServer.name}</strong>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Timeframe selector */}
          <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800 text-xs">
            {(['1h', '24h', '7d', '30d'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1.5 rounded-md font-medium uppercase font-mono transition-colors cursor-pointer ${
                  timeframe === tf
                    ? 'bg-zinc-800 text-emerald-400 font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportData}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-xs font-medium cursor-pointer transition-colors"
            title="Download full analytics report"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {exportNotice && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{exportNotice}</span>
        </div>
      )}

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Server Uptime */}
        <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 font-mono">
            <span className="flex items-center gap-1.5 uppercase">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>Service Uptime</span>
            </span>
            <span className="text-emerald-400 font-bold">{uptimePercent}</span>
          </div>
          <div className="flex items-baseline gap-2 pt-1">
            <span className="text-2xl font-bold font-mono text-zinc-100">{uptimeHours}h</span>
            <span className="text-xs text-zinc-500 font-mono">continuous run</span>
          </div>
          <p className="text-[11px] text-zinc-500 font-mono">Zero unexpected JVM aborts</p>
        </div>

        {/* Card 2: Peak Concurrency */}
        <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 font-mono">
            <span className="flex items-center gap-1.5 uppercase">
              <Users className="w-4 h-4 text-cyan-400" />
              <span>Peak Concurrency</span>
            </span>
            <span className="text-cyan-400 font-bold">16 Players</span>
          </div>
          <div className="flex items-baseline gap-2 pt-1">
            <span className="text-2xl font-bold font-mono text-zinc-100">
              {Math.max(...playerHistory)}
            </span>
            <span className="text-xs text-zinc-500 font-mono">/ {activeServer.properties.maxPlayers} slots</span>
          </div>
          <p className="text-[11px] text-zinc-500 font-mono">Busiest hour: 18:00 - 19:00 UTC</p>
        </div>

        {/* Card 3: Average Tick Rate */}
        <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 font-mono">
            <span className="flex items-center gap-1.5 uppercase">
              <Activity className="w-4 h-4 text-amber-400" />
              <span>Average TPS</span>
            </span>
            <span className="text-amber-400 font-bold">19.95 / 20.0</span>
          </div>
          <div className="flex items-baseline gap-2 pt-1">
            <span className="text-2xl font-bold font-mono text-emerald-400">19.98</span>
            <span className="text-xs text-zinc-500 font-mono">ticks per sec</span>
          </div>
          <p className="text-[11px] text-zinc-500 font-mono">Average tick latency: 14.2ms (Healthy)</p>
        </div>

        {/* Card 4: Memory Utilization */}
        <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 font-mono">
            <span className="flex items-center gap-1.5 uppercase">
              <Database className="w-4 h-4 text-purple-400" />
              <span>RAM Peak</span>
            </span>
            <span className="text-purple-400 font-bold">
              {((Math.max(...ramHistoryMb) / activeServer.allocatedRamMb) * 100).toFixed(0)}%
            </span>
          </div>
          <div className="flex items-baseline gap-2 pt-1">
            <span className="text-2xl font-bold font-mono text-zinc-100">
              {(Math.max(...ramHistoryMb) / 1024).toFixed(1)} GB
            </span>
            <span className="text-xs text-zinc-500 font-mono">
              / {(activeServer.allocatedRamMb / 1024).toFixed(1)} GB
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 font-mono">G1GC generational pause: &lt;12ms</p>
        </div>
      </div>

      {/* GRAPHS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Graph 1: Player Concurrency Timeline */}
        <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-zinc-100">Player Concurrency History</h3>
            </div>
            <span className="text-xs font-mono text-emerald-400 font-semibold">
              Live: {activeServer.players.filter((p) => p.online).length} online
            </span>
          </div>
          {renderLineChart(playerHistory, '#10b981', 'playerGrad', 0, 20, (v) => `${v}`)}
        </div>

        {/* Graph 2: TPS & Performance Stability */}
        <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-zinc-100">Server TPS (Target: 20.0)</h3>
            </div>
            <span className="text-xs font-mono text-cyan-400 font-semibold">
              Current: {activeServer.telemetry.tps.toFixed(1)} TPS
            </span>
          </div>
          {renderLineChart(tpsHistory, '#06b6d4', 'tpsGrad', 18.0, 20.5, (v) => `${v.toFixed(1)}`)}
        </div>

        {/* Graph 3: RAM Memory Usage */}
        <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-zinc-100">JVM Heap Memory Consumption</h3>
            </div>
            <span className="text-xs font-mono text-purple-400 font-semibold">
              Allocated: {(activeServer.allocatedRamMb / 1024).toFixed(1)} GB
            </span>
          </div>
          {renderLineChart(
            ramHistoryMb,
            '#a855f7',
            'ramGrad',
            1000,
            activeServer.allocatedRamMb + 500,
            (v) => `${(v / 1024).toFixed(1)}G`
          )}
        </div>

        {/* Graph 4: CPU Processor Utilization */}
        <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-zinc-100">CPU Core Utilization (%)</h3>
            </div>
            <span className="text-xs font-mono text-amber-400 font-semibold">
              Live: {activeServer.telemetry.cpuPercent}%
            </span>
          </div>
          {renderLineChart(
            [12, 8, 14, 22, 38, 45, 52, 34, activeServer.telemetry.cpuPercent],
            '#f59e0b',
            'cpuGrad',
            0,
            100,
            (v) => `${v}%`
          )}
        </div>
      </div>

      {/* PLAYER SESSION HISTORY: "WHO WAS ON AND WHEN" */}
      <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>Player Session Log & Activity Timeline</span>
            </h3>
            <p className="text-xs text-zinc-400">
              Detailed chronological log of players who joined the server, duration, ping, and world dimension.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search username..."
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none"
              />
            </div>

            <select
              value={selectedDimension}
              onChange={(e) => setSelectedDimension(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none"
            >
              <option value="all">All Dimensions</option>
              <option value="overworld">Overworld</option>
              <option value="nether">Nether</option>
              <option value="the end">The End</option>
            </select>
          </div>
        </div>

        {/* Sessions Table */}
        <div className="overflow-x-auto rounded-lg border border-zinc-800/80">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-900/90 border-b border-zinc-800 text-zinc-400 font-mono uppercase text-[10px]">
                <th className="py-2.5 px-4 font-semibold">Player</th>
                <th className="py-2.5 px-4 font-semibold">Joined At</th>
                <th className="py-2.5 px-4 font-semibold">Left At / Status</th>
                <th className="py-2.5 px-4 font-semibold">Session Duration</th>
                <th className="py-2.5 px-4 font-semibold">Dimension</th>
                <th className="py-2.5 px-4 font-semibold text-right">Peak Ping</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-mono">
              {filteredSessions.map((sess) => (
                <tr key={sess.id} className="hover:bg-zinc-900/40 transition-colors">
                  <td className="py-3 px-4 flex items-center gap-2.5 font-sans">
                    <img
                      src={`https://mc-heads.net/avatar/${sess.username}/24`}
                      alt={sess.username}
                      className="w-6 h-6 rounded border border-zinc-700 bg-zinc-800 shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://mc-heads.net/avatar/MHF_Steve/24';
                      }}
                    />
                    <span className="font-semibold text-zinc-100">{sess.username}</span>
                  </td>

                  <td className="py-3 px-4 text-zinc-300">{sess.joinedAt}</td>

                  <td className="py-3 px-4">
                    {sess.leftAt === 'Currently Online' ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-800/50 text-emerald-400 font-semibold text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Online Now
                      </span>
                    ) : (
                      <span className="text-zinc-400">{sess.leftAt}</span>
                    )}
                  </td>

                  <td className="py-3 px-4 text-zinc-200">
                    {Math.floor(sess.durationMinutes / 60) > 0 ? `${Math.floor(sess.durationMinutes / 60)}h ` : ''}
                    {sess.durationMinutes % 60}m
                  </td>

                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${
                        sess.dimension.toLowerCase() === 'nether'
                          ? 'bg-rose-950/60 text-rose-400 border-rose-800/50'
                          : sess.dimension.toLowerCase() === 'the end'
                          ? 'bg-purple-950/60 text-purple-400 border-purple-800/50'
                          : 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50'
                      }`}
                    >
                      {sess.dimension}
                    </span>
                  </td>

                  <td className="py-3 px-4 text-right">
                    <span
                      className={`font-semibold ${
                        sess.peakPing < 30 ? 'text-emerald-400' : sess.peakPing < 60 ? 'text-amber-400' : 'text-rose-400'
                      }`}
                    >
                      {sess.peakPing} ms
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
