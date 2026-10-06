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
} from 'lucide-react';
import { useServer } from '../../context/ServerContext';
import { useAuth } from '../../context/AuthContext';

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

  const [activeTab, setActiveTab] = useState<'general' | 'vault'>('general');
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!isOpen) return null;

  const archivedServers = servers.filter((s) => s.isArchived);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
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
              <h2 className="text-base font-bold text-zinc-100">CraftyForge Wrapper Settings</h2>
              <p className="text-xs text-zinc-400">Global launcher preferences & archived instances vault</p>
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
            onClick={() => setActiveTab('vault')}
            className={`px-4 py-2 border-b-2 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'vault'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Archived Servers Vault</span>
            {archivedServers.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-950/60 text-amber-400 text-[10px] font-mono border border-amber-800/40">
                {archivedServers.length}
              </span>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {saveSuccess && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 rounded-lg flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Wrapper settings saved successfully!</span>
            </div>
          )}

          {activeTab === 'general' && (
            <form onSubmit={handleSave} className="space-y-6">
              {/* EULA Setting (Auto-accept) */}
              <div className="p-4 bg-zinc-900/80 rounded-xl border border-zinc-800 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-zinc-200">
                        Auto-Accept Minecraft EULA (Mojang)
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Automatically writes <code className="text-emerald-400 font-mono bg-zinc-950 px-1 py-0.5 rounded">eula=true</code> into newly created server directories. Bypasses manual eula.txt confirmation so servers launch immediately on first boot.
                    </p>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                    <input
                      type="checkbox"
                      checked={wrapperSettings.autoAcceptEula}
                      onChange={(e) => updateWrapperSettings({ autoAcceptEula: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              </div>

              {/* Memory Defaults in GB */}
              <div className="p-4 bg-zinc-900/80 rounded-xl border border-zinc-800 space-y-4">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-zinc-200">
                    Default RAM Allocation For New Servers (in GB)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                  <div className="space-y-1.5">
                    <label className="text-zinc-400 block">Default Minimum RAM (-Xms)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="64"
                        step="1"
                        value={wrapperSettings.defaultMinRamGb || 2}
                        onChange={(e) => updateWrapperSettings({ defaultMinRamGb: Number(e.target.value) || 1 })}
                        className="w-full bg-[#0a0d12] border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-emerald-500"
                      />
                      <span className="text-emerald-400 text-xs font-bold">GB</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-zinc-400 block">Default Maximum RAM (-Xmx)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="128"
                        step="1"
                        value={wrapperSettings.defaultMaxRamGb || 4}
                        onChange={(e) => updateWrapperSettings({ defaultMaxRamGb: Number(e.target.value) || 2 })}
                        className="w-full bg-[#0a0d12] border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-emerald-500"
                      />
                      <span className="text-emerald-400 text-xs font-bold">GB</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Network and Ports with 2 boxes and dash */}
              <div className="p-4 bg-zinc-900/80 rounded-xl border border-zinc-800 space-y-4">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-zinc-200">
                    Server Port Range (Auto-Assignment)
                  </span>
                </div>

                <div className="space-y-1.5 text-xs font-mono">
                  <label className="text-zinc-400 block">
                    Available Port Range for New Servers
                  </label>
                  <p className="text-[11px] text-zinc-500 font-sans">
                    New servers created in the wizard will default to the lowest untaken port in this range. If all ports are taken, the port field will be left blank.
                  </p>
                  <div className="flex items-center gap-3 pt-1">
                    <div className="flex-1">
                      <input
                        type="number"
                        min="1024"
                        max="65535"
                        value={wrapperSettings.portRangeStart || 25560}
                        onChange={(e) => updateWrapperSettings({ portRangeStart: Number(e.target.value) || 25560 })}
                        placeholder="25560"
                        className="w-full bg-[#0a0d12] border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-emerald-500 text-center font-mono"
                      />
                    </div>
                    <span className="text-zinc-500 font-bold text-lg select-none">–</span>
                    <div className="flex-1">
                      <input
                        type="number"
                        min="1024"
                        max="65535"
                        value={wrapperSettings.portRangeEnd || 25569}
                        onChange={(e) => updateWrapperSettings({ portRangeEnd: Number(e.target.value) || 25569 })}
                        placeholder="25569"
                        className="w-full bg-[#0a0d12] border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-emerald-500 text-center font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5 pt-2">
                    <label className="text-zinc-400 block">Telemetry Refresh Frequency</label>
                    <select
                      value={wrapperSettings.telemetryIntervalMs}
                      onChange={(e) => updateWrapperSettings({ telemetryIntervalMs: Number(e.target.value) })}
                      className="w-full bg-[#0a0d12] border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100"
                    >
                      <option value={1500}>1.5 seconds (High fidelity)</option>
                      <option value={2500}>2.5 seconds (Balanced)</option>
                      <option value={5000}>5.0 seconds (Low CPU)</option>
                    </select>
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
                            onClick={() => {
                              if (confirm(`Permanently delete archived server "${srv.name}"? This cannot be undone.`)) {
                                deleteServer(srv.id);
                              }
                            }}
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
    </div>
  );
};
