import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Sparkles,
  Layers,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
  Server,
  Zap,
  Download,
  Check,
  Loader2,
} from 'lucide-react';
import { useServer } from '../../context/ServerContext';
import { useAuth } from '../../context/AuthContext';
import { ServerLoader } from '../../types/server';
import {
  fetchMinecraftVersions,
  fetchFabricLoaderVersions,
  fetchPaperBuilds,
  getLatestLoaderVersion,
} from '../../services/loadersApi';

export const LoaderCorePage: React.FC = () => {
  const { activeServer, upgradeLoader, changeLoader } = useServer();
  const { canPerformAction } = useAuth();

  const [selectedLoader, setSelectedLoader] = useState<ServerLoader>(activeServer.loader);
  const [selectedMcVersion, setSelectedMcVersion] = useState<string>(activeServer.minecraftVersion);
  const [selectedLoaderVersion, setSelectedLoaderVersion] = useState<string>(activeServer.loaderVersion);

  const [isUpdating, setIsUpdating] = useState(false);
  const [updateNotice, setUpdateNotice] = useState<string | null>(null);

  const isServerRunning = activeServer.status === 'online' || activeServer.status === 'starting';

  const latestInfo = getLatestLoaderVersion(activeServer.loader, activeServer.minecraftVersion);

  useEffect(() => {
    setSelectedLoader(activeServer.loader);
    setSelectedMcVersion(activeServer.minecraftVersion);
    const latest = getLatestLoaderVersion(activeServer.loader, activeServer.minecraftVersion);
    setSelectedLoaderVersion(latest.latestVersion);
  }, [activeServer.id]);

  useEffect(() => {
    const latest = getLatestLoaderVersion(selectedLoader, selectedMcVersion);
    setSelectedLoaderVersion(latest.latestVersion);
  }, [selectedLoader, selectedMcVersion]);

  const handleApplyLoaderUpdate = async () => {
    setIsUpdating(true);
    setUpdateNotice(null);
    try {
      await upgradeLoader(activeServer.id);
      setUpdateNotice(`Successfully upgraded ${activeServer.loader.toUpperCase()} to ${latestInfo.latestVersion}!`);
      setTimeout(() => setUpdateNotice(null), 4000);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleChangeCoreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    setTimeout(() => {
      changeLoader(activeServer.id, selectedLoader, selectedLoaderVersion, selectedMcVersion);
      setIsUpdating(false);
      setUpdateNotice(`Switched server core to ${selectedLoader.toUpperCase()} (${selectedLoaderVersion})!`);
      setTimeout(() => setUpdateNotice(null), 4000);
    }, 1200);
  };

  const loaderOptions: { id: ServerLoader; name: string; desc: string; color: string }[] = [
    {
      id: 'fabric',
      name: 'Fabric Loader',
      desc: 'High performance modding toolchain with instant snapshot compatibility.',
      color: 'text-emerald-400 border-emerald-500/40',
    },
    {
      id: 'neoforge',
      name: 'NeoForge',
      desc: 'Modern community-driven loader for heavy tech and adventure modpacks.',
      color: 'text-amber-400 border-amber-500/40',
    },
    {
      id: 'paper',
      name: 'PaperMC (Spigot/Bukkit)',
      desc: 'Optimized server core for Bukkit & Spigot plugins, low TPS drops.',
      color: 'text-red-400 border-red-500/40',
    },
    {
      id: 'purpur',
      name: 'Purpur',
      desc: 'High-performance drop-in replacement for Paper with customizable gameplay mechanics.',
      color: 'text-purple-400 border-purple-500/40',
    },
    {
      id: 'quilt',
      name: 'Quilt Loader',
      desc: 'Modular, community-driven loader compatible with standard Fabric mods.',
      color: 'text-cyan-400 border-cyan-500/40',
    },
    {
      id: 'forge',
      name: 'Minecraft Forge',
      desc: 'Traditional loader for classic modpacks on 1.20.1, 1.19.2, and older.',
      color: 'text-blue-400 border-blue-500/40',
    },
    {
      id: 'vanilla',
      name: 'Mojang Vanilla',
      desc: 'Pure official Minecraft server jar with zero mod or plugin modifications.',
      color: 'text-zinc-400 border-zinc-600',
    },
  ];

  const mcVersions = ['1.21.4', '1.21.3', '1.21.1', '1.20.4', '1.20.1', '1.19.4', '1.18.2'];

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto w-full space-y-6">
      {/* Header */}
      <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <span>Server Core & Loader Updates</span>
                {activeServer.hasLoaderUpdate && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-600/60">
                    ! UPDATE AVAILABLE
                  </span>
                )}
              </h1>
              <p className="text-xs text-zinc-400">
                Manage the executable runtime jar for <strong className="text-zinc-200">{activeServer.name}</strong> · Upgrade Fabric, Paper, NeoForge or switch loaders
              </p>
            </div>
          </div>
        </div>
      </div>

      {updateNotice && (
        <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{updateNotice}</span>
        </div>
      )}

      {isServerRunning && (
        <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-600/50 text-xs text-amber-200 flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            Server is currently running. Stop the server before upgrading the runtime JAR or switching loaders.
          </span>
        </div>
      )}

      {/* CURRENT INSTALLED LOADER CARD */}
      <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
          <Server className="w-4 h-4 text-emerald-400" />
          <span>Current Active Core Executable</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-800 space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase">Core Type</span>
            <p className="text-sm font-bold text-zinc-100 capitalize">{activeServer.loader}</p>
            <p className="text-[11px] text-zinc-400">Minecraft {activeServer.minecraftVersion}</p>
          </div>

          <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-800 space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase">Installed Build / Version</span>
            <p className="text-sm font-bold text-zinc-100">{activeServer.loaderVersion}</p>
            <p className="text-[11px] text-zinc-400">
              Jar: <code className="text-zinc-300">{activeServer.loader}-server.jar</code>
            </p>
          </div>

          <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-800 space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase">Upstream Status</span>
            {activeServer.hasLoaderUpdate ? (
              <p className="text-sm font-bold text-amber-400">Update Available</p>
            ) : (
              <p className="text-sm font-bold text-emerald-400">Up to Date</p>
            )}
            <p className="text-[11px] text-zinc-400">Latest: {latestInfo.latestVersion}</p>
          </div>
        </div>

        {/* 1-Click Update Banner if outdated */}
        {activeServer.hasLoaderUpdate && (
          <div className="p-4 bg-amber-950/30 border border-amber-600/40 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <span className="font-bold text-amber-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                New {activeServer.loader.toUpperCase()} {latestInfo.latestVersion} Ready to Install
              </span>
              <p className="text-zinc-300 max-w-xl leading-relaxed">
                {latestInfo.changelogSnippet}
              </p>
            </div>

            {canPerformAction('manage_servers') && (
              <div title={isServerRunning ? 'Stop the server to make this change' : undefined}>
                <button
                  onClick={handleApplyLoaderUpdate}
                  disabled={isUpdating || isServerRunning}
                  className={`px-4 py-2 rounded-lg font-bold flex items-center gap-1.5 shadow-md shadow-emerald-950/40 transition-colors ${
                    isServerRunning
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700 opacity-60'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                  }`}
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Upgrading .jar...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>1-Click Upgrade Jar</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SWITCH OR RECONFIGURE CORE LOADER */}
      <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <span>Switch or Reconfigure Server Loader</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Need to migrate this server from Vanilla to Fabric, or install Paper for plugins? Select the desired loader and version below.
          </p>
        </div>

        <form onSubmit={handleChangeCoreSubmit} className="space-y-4">
          {/* Loader Selection Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {loaderOptions.map((ldr) => (
              <button
                key={ldr.id}
                type="button"
                onClick={() => setSelectedLoader(ldr.id)}
                className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                  selectedLoader === ldr.id
                    ? 'bg-zinc-800 border-emerald-500 text-zinc-100 ring-1 ring-emerald-500/40'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs uppercase font-mono">{ldr.name}</span>
                  {selectedLoader === ldr.id && (
                    <span className="text-[10px] text-emerald-400 font-bold">Selected</span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">{ldr.desc}</p>
              </button>
            ))}
          </div>

          {/* Versions selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
            <div className="space-y-1">
              <label className="text-zinc-400 font-mono text-[11px] uppercase">Minecraft Game Version</label>
              <select
                value={selectedMcVersion}
                onChange={(e) => setSelectedMcVersion(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none"
              >
                {mcVersions.map((v) => (
                  <option key={v} value={v}>
                    Minecraft {v}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-zinc-400 font-mono text-[11px] uppercase">
                {selectedLoader.toUpperCase()} Loader Build / Version
              </label>
              <input
                type="text"
                value={selectedLoaderVersion}
                onChange={(e) => setSelectedLoaderVersion(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 font-mono focus:outline-none"
              />
            </div>
          </div>

          <div className="p-3 bg-zinc-900/80 rounded-lg border border-zinc-800 text-[11px] text-zinc-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Worlds and configuration files will remain intact. Server reboot will be required after replacing core jar.</span>
          </div>

          {canPerformAction('manage_servers') && (
            <div className="flex justify-end pt-2" title={isServerRunning ? 'Stop the server to make this change' : undefined}>
              <button
                type="submit"
                disabled={isUpdating || isServerRunning}
                className={`px-5 py-2.5 rounded-lg text-xs font-bold shadow-md shadow-emerald-950/40 flex items-center gap-2 transition-colors ${
                  isServerRunning
                    ? 'bg-zinc-800 text-zinc-500 border border-zinc-700 opacity-60 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                }`}
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deploying Core...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Apply Core Changes</span>
                  </>
                )}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
