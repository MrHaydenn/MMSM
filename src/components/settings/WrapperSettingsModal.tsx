import React, { useState } from 'react';
import {
  Settings,
  X,
  Archive,
  RotateCcw,
  Trash2,
  CheckCircle2,
  Sliders,
  Shield,
  Server,
  Database,
  Cpu,
  FileCheck,
  AlertTriangle,
  Terminal,
  Download,
  Copy,
  Check,
  Folder,
  Globe,
  Image,
} from 'lucide-react';
import { useServer } from '../../context/ServerContext';
import { useAuth } from '../../context/AuthContext';
import { MinecraftServer } from '../../types/server';

interface WrapperSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WrapperSettingsModal: React.FC<WrapperSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    servers,
    unarchiveServer,
    deleteServer,
    wrapperSettings,
    updateWrapperSettings,
  } = useServer();
  const { canPerformAction } = useAuth();

  const [activeTab, setActiveTab] = useState<'general' | 'launcher' | 'vault'>('general');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [deleteConfirmServer, setDeleteConfirmServer] = useState<MinecraftServer | null>(null);
  const [copiedBatch, setCopiedBatch] = useState(false);

  if (!isOpen) return null;

  const archivedServers = servers.filter((s) => s.isArchived);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const batchScriptContent = `@echo off
title MMSM - MrHaydenn's Minecraft Server Manager
color 0A
cls
echo ===================================================
echo   Starting MMSM - Minecraft Server Manager Wrapper
echo ===================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js (v18+) from https://nodejs.org
    pause
    exit /b
)

if not exist node_modules (
    echo [MMSM] Installing dependencies (first run)...
    call npm install
)

echo [MMSM] Launching server management wrapper on http://localhost:3000 ...
start http://localhost:3000
npm run dev
pause
`;

  const handleDownloadLauncher = () => {
    const blob = new Blob([batchScriptContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'start-mmsm.bat';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyBatch = () => {
    navigator.clipboard.writeText(batchScriptContent);
    setCopiedBatch(true);
    setTimeout(() => setCopiedBatch(false), 2500);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-[#11151c] border border-zinc-800 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100">MMSM Wrapper Settings</h2>
              <p className="text-xs text-zinc-400">Global launcher preferences, startup scripts & archived instances</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 border border-zinc-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 pt-3 border-b border-zinc-800 flex items-center gap-2 bg-[#0d1017]">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2 border-b-2 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'general'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Launcher & Defaults</span>
          </button>

          <button
            onClick={() => setActiveTab('launcher')}
            className={`px-4 py-2 border-b-2 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'launcher'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Standalone Startup (.bat / CMD)</span>
          </button>

          <button
            onClick={() => setActiveTab('vault')}
            className={`px-4 py-2 border-b-2 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'vault'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Archived Servers ({archivedServers.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {saveSuccess && (
            <div className="p-3.5 bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 rounded-xl flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Wrapper settings saved successfully!</span>
            </div>
          )}

          {activeTab === 'general' && (
            <form onSubmit={handleSave} className="space-y-6">
              {/* Directory Paths Configuration */}
              <div className="p-4 bg-zinc-900/80 rounded-xl border border-zinc-800 space-y-4">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-zinc-200 uppercase tracking-wide">
                    Default Storage Locations
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="space-y-1">
                    <label className="text-zinc-300 font-medium flex items-center justify-between">
                      <span>Default Servers Directory</span>
                      <span className="text-[10px] text-zinc-500 font-mono">Each server created in its own folder</span>
                    </label>
                    <input
                      type="text"
                      value={wrapperSettings.serversDirectory || '/Servers'}
                      onChange={(e) =>
                        updateWrapperSettings({ serversDirectory: e.target.value })
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-zinc-300 font-medium flex items-center justify-between">
                      <span>Default Backups Directory</span>
                      <span className="text-[10px] text-zinc-500 font-mono">Secondary drives supported (e.g. D:/Backups)</span>
                    </label>
                    <input
                      type="text"
                      value={wrapperSettings.backupsDirectory || '/Backups'}
                      onChange={(e) =>
                        updateWrapperSettings({ backupsDirectory: e.target.value })
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Public Connection Settings */}
              <div className="p-4 bg-zinc-900/80 rounded-xl border border-zinc-800 space-y-4">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-zinc-200 uppercase tracking-wide">
                    Public Connection IP / Domain
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <label className="text-zinc-300 font-medium">Public IP / Hostname for Players</label>
                  <input
                    type="text"
                    placeholder="e.g. play.craftyfleet.com or 142.250.190.46"
                    value={wrapperSettings.publicIp || ''}
                    onChange={(e) => updateWrapperSettings({ publicIp: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[11px] text-zinc-500 font-mono">
                    This address will be displayed on server cards for players to connect to.
                  </p>
                </div>
              </div>

              {/* Memory Defaults in GB */}
              <div className="p-4 bg-zinc-900/80 rounded-xl border border-zinc-800 space-y-4">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-zinc-200 uppercase tracking-wide">
                    Default Memory Allocations (GB)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  <div className="space-y-1.5">
                    <label className="text-zinc-400 block font-sans">Default Min RAM (-Xms)</label>
                    <select
                      value={wrapperSettings.defaultMinRamGb}
                      onChange={(e) =>
                        updateWrapperSettings({ defaultMinRamGb: Number(e.target.value) })
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none"
                    >
                      {[1, 2, 4, 6, 8, 12, 16].map((gb) => (
                        <option key={gb} value={gb}>
                          {gb} GB ({gb * 1024} MB)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-zinc-400 block font-sans">Default Max RAM (-Xmx)</label>
                    <select
                      value={wrapperSettings.defaultMaxRamGb}
                      onChange={(e) =>
                        updateWrapperSettings({ defaultMaxRamGb: Number(e.target.value) })
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none"
                    >
                      {[2, 4, 6, 8, 12, 16, 24, 32, 64].map((gb) => (
                        <option key={gb} value={gb}>
                          {gb} GB ({gb * 1024} MB)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Port Range */}
              <div className="p-4 bg-zinc-900/80 rounded-xl border border-zinc-800 space-y-4">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-zinc-200 uppercase tracking-wide">
                    Auto-Allocation Port Range
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  <div className="space-y-1.5">
                    <label className="text-zinc-400 block font-sans">Start Port</label>
                    <input
                      type="number"
                      value={wrapperSettings.portRangeStart}
                      onChange={(e) =>
                        updateWrapperSettings({ portRangeStart: Number(e.target.value) })
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-zinc-400 block font-sans">End Port</label>
                    <input
                      type="number"
                      value={wrapperSettings.portRangeEnd}
                      onChange={(e) =>
                        updateWrapperSettings({ portRangeEnd: Number(e.target.value) })
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/40 cursor-pointer transition-colors"
                >
                  Save Settings
                </button>
              </div>
            </form>
          )}

          {activeTab === 'launcher' && (
            <div className="space-y-5">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-zinc-200">Standalone Startup Launcher (.bat & CMD)</h3>
                <p className="text-xs text-zinc-400">
                  Run this wrapper easily on Windows or any other computer by launching the batch script or terminal command.
                </p>
              </div>

              {/* One-Click Download Box */}
              <div className="p-4 bg-emerald-950/20 border border-emerald-800/40 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h4 className="text-xs font-bold text-zinc-100">start-mmsm.bat (Windows Launcher)</h4>
                      <p className="text-[11px] text-zinc-400">Double-click to start wrapper & launch dashboard in browser</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadLauncher}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950/40 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download start-mmsm.bat</span>
                  </button>
                </div>
              </div>

              {/* Script Code Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                  <span>Batch Script Contents (CMD / PowerShell):</span>
                  <button
                    type="button"
                    onClick={handleCopyBatch}
                    className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 cursor-pointer font-sans"
                  >
                    {copiedBatch ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedBatch ? 'Copied!' : 'Copy Script'}</span>
                  </button>
                </div>

                <pre className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-[11px] font-mono text-zinc-300 overflow-x-auto leading-relaxed">
                  {batchScriptContent}
                </pre>
              </div>

              <div className="p-4 bg-zinc-900/60 rounded-xl border border-zinc-800 space-y-2 text-xs text-zinc-400">
                <p className="font-semibold text-zinc-200">How to launch on another computer:</p>
                <ol className="list-decimal list-inside space-y-1 font-mono text-[11px]">
                  <li>Copy project files to the target computer.</li>
                  <li>Ensure Node.js (v18+) is installed.</li>
                  <li>Double click <strong className="text-emerald-400">start-mmsm.bat</strong> (or run <code className="text-zinc-200">npm run dev</code>).</li>
                  <li>The dashboard will launch automatically on <strong className="text-zinc-200">http://localhost:3000</strong>.</li>
                </ol>
              </div>
            </div>
          )}

          {activeTab === 'vault' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    Archived Servers ({archivedServers.length})
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Archived servers are kept offline and hidden from the dashboard. You can restore them anytime.
                  </p>
                </div>
              </div>

              {archivedServers.length === 0 ? (
                <div className="p-8 text-center bg-zinc-900/40 border border-dashed border-zinc-800 rounded-2xl space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-zinc-800/80 flex items-center justify-center mx-auto text-zinc-500">
                    <Archive className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-zinc-300">No Archived Servers</p>
                    <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                      All your configured servers are currently active on the main dashboard. To archive a server, click the Archive button on any server card.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {archivedServers.map((srv) => (
                    <div
                      key={srv.id}
                      className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl flex flex-wrap items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-zinc-600" />
                          <h4 className="text-sm font-bold text-zinc-200">{srv.name}</h4>
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                            Archived
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 font-mono">
                          {srv.loader.toUpperCase()} {srv.loaderVersion} · MC {srv.minecraftVersion} · Port :{srv.port} · {srv.mods.length} mods
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => unarchiveServer(srv.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-600/30 text-xs font-semibold transition-colors cursor-pointer"
                          title="Restore server back to active dashboard"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Restore Server</span>
                        </button>

                        {canPerformAction('manage_servers') && (
                          <button
                            onClick={() => setDeleteConfirmServer(srv)}
                            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-rose-950/40 text-zinc-500 hover:text-rose-400 border border-zinc-800 transition-colors cursor-pointer"
                            title="Permanently Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* IN-APP CONFIRMATION MODAL FOR DELETING ARCHIVED SERVER */}
      {deleteConfirmServer && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#11151c] border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-100">Permanently Delete Server?</h3>
                <p className="text-xs text-zinc-400">Irreversible file deletion warning</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-white font-mono">{deleteConfirmServer.name}</strong>?
              All world files, configuration data, playerdata, and installed mods will be permanently erased.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setDeleteConfirmServer(null)}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold border border-zinc-800 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteServer(deleteConfirmServer.id);
                  setDeleteConfirmServer(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-950/40 cursor-pointer transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
