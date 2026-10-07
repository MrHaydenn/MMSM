import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal as TerminalIcon,
  Play,
  Square,
  RotateCw,
  Skull,
  Send,
  Trash2,
  Download,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  ArrowDownCircle,
  Copy,
  Check,
  Globe,
  Sparkles,
} from 'lucide-react';
import { useServer } from '../../context/ServerContext';
import { useAuth } from '../../context/AuthContext';
import { ServerLog } from '../../types/server';
import { GeminiCrashModal } from '../common/GeminiCrashModal';

export const ConsoleView: React.FC = () => {
  const {
    activeServer,
    serverLogs,
    startServer,
    stopServer,
    restartServer,
    killServer,
    executeCommand,
    clearLogs,
  } = useServer();
  const { canPerformAction } = useAuth();

  const [commandInput, setCommandInput] = useState('');
  const [filterLevel, setFilterLevel] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR' | 'CHAT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isGeminiModalOpen, setIsGeminiModalOpen] = useState(false);
  const [isInstallingJava, setIsInstallingJava] = useState<string | null>(null);
  const [installStatus, setInstallStatus] = useState<string | null>(null);
  const [commandHistory, setCommandHistory] = useState<string[]>([
    '/tps',
    '/list',
    '/save-all',
    '/say Hello from CraftyForge!',
  ]);

  const handleInstallJavaInConsole = async (ver: '21' | '25') => {
    setIsInstallingJava(ver);
    setInstallStatus(`Installing Java ${ver}...`);
    try {
      const res = await fetch('/api/system/install-java', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: ver }),
      });
      const data = await res.json();
      if (data.success) {
        let isDone = false;
        let attempts = 0;
        while (!isDone && attempts < 120) {
          await new Promise((r) => setTimeout(r, 1000));
          attempts++;
          try {
            const stRes = await fetch('/api/system/install-java/status');
            const stData = await stRes.json();
            const job = stData.jobs?.[ver];
            if (job) {
              if (job.status === 'completed') {
                setInstallStatus(`Java ${ver} installed! Restarting server...`);
                isDone = true;
                setTimeout(() => {
                  setInstallStatus(null);
                  startServer(activeServer.id);
                }, 1200);
              } else if (job.status === 'failed') {
                setInstallStatus(`Failed: ${job.error || 'Unknown error'}`);
                isDone = true;
              } else if (job.message) {
                setInstallStatus(job.message);
              }
            }
          } catch {}
        }
      } else {
        setInstallStatus(`Failed: ${data.error || 'Unknown error'}`);
      }
    } catch {
      setInstallStatus('Network error during install');
    } finally {
      setIsInstallingJava(null);
    }
  };

  const consoleEndRef = useRef<HTMLDivElement>(null);
  const logs = serverLogs[activeServer.id] || [];

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    if (filterLevel !== 'ALL' && log.level !== filterLevel) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        log.message.toLowerCase().includes(q) ||
        log.thread.toLowerCase().includes(q) ||
        log.timestamp.includes(q)
      );
    }
    return true;
  });

  useEffect(() => {
    if (autoScroll && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [filteredLogs, autoScroll]);

  const handleSendCommand = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!commandInput.trim()) return;

    executeCommand(commandInput, activeServer.id);
    setCommandHistory((prev) => [commandInput, ...prev.slice(0, 30)]);
    setCommandInput('');
    setHistoryIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length === 0) return;
      const nextIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
      setHistoryIndex(nextIndex);
      setCommandInput(commandHistory[nextIndex] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIndex = historyIndex - 1;
        setHistoryIndex(nextIndex);
        setCommandInput(commandHistory[nextIndex] || '');
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCommandInput('');
      }
    }
  };

  const handleCopyLogs = () => {
    const text = logs
      .map((l) => `[${l.timestamp}] [${l.thread}/${l.level}]: ${l.message}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadLogs = () => {
    const text = logs
      .map((l) => `[${l.timestamp}] [${l.thread}/${l.level}]: ${l.message}`)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeServer.name.toLowerCase().replace(/\s+/g, '-')}-latest.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getLogColor = (level: ServerLog['level']) => {
    switch (level) {
      case 'ERROR':
        return 'text-rose-400 bg-rose-950/20';
      case 'WARN':
        return 'text-amber-300 bg-amber-950/20';
      case 'CHAT':
        return 'text-emerald-400 font-medium';
      case 'CMD':
        return 'text-cyan-400 font-semibold';
      case 'INFO':
      default:
        return 'text-zinc-300';
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] p-4 md:p-6 space-y-4 max-w-[1600px] mx-auto w-full">
      {/* CRASH DETECTED ALERT BANNER */}
      {activeServer.status === 'crashed' && (
        <div className="bg-rose-950/40 border border-rose-500/50 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-rose-200 animate-in fade-in">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400 mt-0.5 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Server Crash / Process Exit Detected
              </h3>
              <p className="text-xs text-rose-300/90 leading-relaxed mt-0.5">
                Process exited unexpectedly. Ensure the correct Java runtime (Java 21 LTS for modern cores or Java 17 for 1.17–1.20) is installed.
              </p>
              {installStatus && (
                <p className="text-xs text-emerald-300 font-mono font-bold mt-1.5 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{installStatus}</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0 w-full md:w-auto justify-end">
            <button
              onClick={() => setIsGeminiModalOpen(true)}
              className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-purple-950/40 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-200" />
              <span>Ask Gemini AI</span>
            </button>
            <button
              onClick={() => handleInstallJavaInConsole('21')}
              disabled={!!isInstallingJava}
              className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white border border-emerald-500/50 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-emerald-200" />
              <span>{isInstallingJava === '21' ? 'Installing 21...' : 'Install Java 21 LTS'}</span>
            </button>
            <button
              onClick={() => restartServer(activeServer.id)}
              className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Restart Server</span>
            </button>
          </div>
        </div>
      )}

      <GeminiCrashModal
        isOpen={isGeminiModalOpen}
        onClose={() => setIsGeminiModalOpen(false)}
        server={activeServer}
        logs={logs}
      />

      {/* Top Telemetry & Power Bar */}
      <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        {/* Status & Quick Stats */}
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <span
              className={`w-3.5 h-3.5 rounded-full ${
                activeServer.status === 'online'
                  ? 'bg-emerald-500 shadow-md shadow-emerald-500/50'
                  : activeServer.status === 'starting'
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-zinc-600'
              }`}
            />
            <div>
              <p className="text-sm font-semibold text-zinc-100 capitalize">
                {activeServer.status}
              </p>
              <p className="text-[11px] text-zinc-400 font-mono">
                Port: {activeServer.port} · Java 21
              </p>
            </div>
          </div>

          <div className="h-8 w-[1px] bg-zinc-800 hidden sm:block" />

          {/* Quick Real-Time Metrics */}
          <div className="flex items-center gap-6 text-xs">
            <div>
              <span className="text-zinc-500 block text-[10px] uppercase font-mono">TPS</span>
              <span
                className={`font-mono font-semibold text-sm ${
                  activeServer.telemetry.tps >= 19.5
                    ? 'text-emerald-400'
                    : 'text-amber-400'
                }`}
              >
                {activeServer.status === 'online' ? activeServer.telemetry.tps.toFixed(2) : '0.00'}
              </span>
            </div>

            <div>
              <span className="text-zinc-500 block text-[10px] uppercase font-mono">CPU</span>
              <span className="font-mono font-semibold text-sm text-zinc-200">
                {activeServer.status === 'online' ? `${activeServer.telemetry.cpuPercent}%` : '0%'}
              </span>
            </div>

            <div>
              <span className="text-zinc-500 block text-[10px] uppercase font-mono">RAM</span>
              <span className="font-mono font-semibold text-sm text-zinc-200">
                {activeServer.status === 'online'
                  ? `${(activeServer.telemetry.ramUsedMb / 1024).toFixed(1)} / ${(
                      activeServer.allocatedRamMb / 1024
                    ).toFixed(1)} GB`
                  : `0 / ${(activeServer.allocatedRamMb / 1024).toFixed(1)} GB`}
              </span>
            </div>

            <div>
              <span className="text-zinc-500 block text-[10px] uppercase font-mono">Players</span>
              <span className="font-mono font-semibold text-sm text-emerald-400">
                {activeServer.players.filter((p) => p.online).length} /{' '}
                {activeServer.properties.maxPlayers}
              </span>
            </div>
          </div>
        </div>

        {/* Power Action Buttons */}
        {canPerformAction('server_power') && (
          <div className="flex items-center gap-2">
            {activeServer.status === 'offline' ? (
              <button
                onClick={() => startServer()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-950/50 transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Server</span>
              </button>
            ) : (
              <>
                <button
                  onClick={() => restartServer()}
                  disabled={activeServer.status !== 'online'}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
                  title="Gracefully restart server"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Restart</span>
                </button>
                <button
                  onClick={() => stopServer()}
                  disabled={activeServer.status === 'stopping'}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-600/30 text-xs font-medium transition-colors cursor-pointer"
                  title="Gracefully stop server (/stop)"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop</span>
                </button>
                <button
                  onClick={() => killServer()}
                  className="p-2 rounded-lg bg-zinc-900 hover:bg-rose-950/40 text-zinc-500 hover:text-rose-400 border border-zinc-800 hover:border-rose-900 transition-colors cursor-pointer"
                  title="Force Kill (SIGKILL)"
                >
                  <Skull className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Join Connection Address Banner */}
      <div className="bg-[#11151c] border border-zinc-800/90 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-zinc-100">Multiplayer Direct Join Address:</span>
              <code className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-emerald-400 font-mono font-bold">
                localhost:{activeServer.port}
              </code>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              {activeServer.port !== 25565 ? (
                <span>⚠️ Note: Port is <strong className="text-emerald-300">:{activeServer.port}</strong>. You must type <code className="text-zinc-200">localhost:{activeServer.port}</code> in Minecraft!</span>
              ) : (
                <span>Standard port 25565 assigned. Join using <code className="text-zinc-200">localhost</code> or your LAN/Public IP.</span>
              )}
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            navigator.clipboard.writeText(`localhost:${activeServer.port}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="px-3.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
          <span>Copy localhost:{activeServer.port}</span>
        </button>
      </div>

      {/* Terminal Header Toolbar */}
      <div className="bg-[#10141a] border border-zinc-800 rounded-t-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-zinc-300 text-xs font-medium">
            <TerminalIcon className="w-4 h-4 text-emerald-400" />
            <span>Interactive Terminal</span>
          </div>

          <div className="h-4 w-[1px] bg-zinc-800 hidden sm:block" />

          {/* Level Filter Tabs */}
          <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800/80">
            {(['ALL', 'INFO', 'WARN', 'ERROR', 'CHAT'] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setFilterLevel(lvl)}
                className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                  filterLevel === lvl
                    ? 'bg-zinc-800 text-emerald-400 font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        {/* Search, Autoscroll & Actions */}
        <div className="flex items-center gap-2">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-2.5 py-1 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 w-36 sm:w-48"
            />
          </div>

          {/* Auto-scroll toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono transition-colors border ${
              autoScroll
                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
            }`}
            title="Auto-scroll to latest log entries"
          >
            <ArrowDownCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Auto-scroll</span>
          </button>

          {/* Copy logs */}
          <button
            onClick={handleCopyLogs}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Copy logs to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Download logs */}
          <button
            onClick={handleDownloadLogs}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Download latest.log"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Clear logs */}
          <button
            onClick={() => clearLogs(activeServer.id)}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-rose-400 transition-colors"
            title="Clear console view"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Black Screen */}
      <div className="flex-1 bg-[#090c10] border-x border-zinc-800 p-4 font-mono text-xs overflow-y-auto leading-relaxed select-text space-y-1">
        {filteredLogs.length === 0 ? (
          <div className="text-zinc-600 text-center py-16">
            <p>No console messages matching current filter.</p>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className={`flex items-start gap-2 py-0.5 hover:bg-zinc-900/60 rounded px-1 transition-colors ${getLogColor(
                log.level
              )}`}
            >
              <span className="text-zinc-600 shrink-0 select-none">[{log.timestamp}]</span>
              <span className="text-zinc-500 shrink-0 select-none">[{log.thread}/{log.level}]:</span>
              <span className="break-all whitespace-pre-wrap flex-1">{log.message}</span>
            </div>
          ))
        )}
        <div ref={consoleEndRef} />
      </div>

      {/* Command Input Bar */}
      <div className="bg-[#11151c] border border-zinc-800 rounded-b-xl p-3 flex items-center gap-3">
        <form onSubmit={handleSendCommand} className="flex-1 flex items-center gap-2">
          <div className="flex items-center gap-2 flex-1 bg-[#090c10] border border-zinc-800 rounded-lg px-3 py-2 focus-within:border-emerald-500/60">
            <span className="text-emerald-400 font-mono font-bold select-none">&gt;</span>
            <input
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!canPerformAction('execute_commands') || activeServer.status !== 'online'}
              placeholder={
                activeServer.status !== 'online'
                  ? 'Server is offline. Start the server to execute commands...'
                  : !canPerformAction('execute_commands')
                  ? 'Operator or Admin permissions required to execute commands'
                  : 'Enter command (e.g. /say, /whitelist add, /gamerule, /tps) · ↑/↓ for history'
              }
              className="flex-1 bg-transparent text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none disabled:cursor-not-allowed"
            />
          </div>

          <button
            type="submit"
            disabled={
              !commandInput.trim() ||
              !canPerformAction('execute_commands') ||
              activeServer.status !== 'online'
            }
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-md shadow-emerald-950/40 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
