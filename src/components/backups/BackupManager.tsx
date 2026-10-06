import React, { useState } from 'react';
import {
  Archive,
  Clock,
  Download,
  RotateCcw,
  Trash2,
  Pin,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  Calendar,
  Layers,
  Plus,
  Loader2,
  Check,
  Folder,
  Sliders,
  Play,
  FileText,
  Settings,
  X,
  Sparkles,
} from 'lucide-react';
import { useServer } from '../../context/ServerContext';
import { useAuth } from '../../context/AuthContext';
import { BackupRecord, BackupRule } from '../../types/server';

const AVAILABLE_BACKUP_TARGETS = [
  { id: 'world', name: 'world/ (Overworld Dimension & Chunks)', size: '~110 MB', category: 'world' },
  { id: 'world_nether', name: 'world_nether/ (Nether Dimension DIM-1)', size: '~32 MB', category: 'world' },
  { id: 'world_the_end', name: 'world_the_end/ (The End Dimension DIM1)', size: '~18 MB', category: 'world' },
  { id: 'mods', name: 'mods/ or plugins/ (Mod & Plugin JARs)', size: '~65 MB', category: 'addons' },
  { id: 'config', name: 'config/ (Mod & Server configurations)', size: '~4.2 MB', category: 'config' },
  { id: 'server.properties', name: 'server.properties (Network, MOTD, Difficulty)', size: '< 1 MB', category: 'config' },
  { id: 'whitelist.json', name: 'whitelist.json & ops.json (Access control)', size: '< 1 MB', category: 'config' },
  { id: 'usercache.json', name: 'usercache.json & banned-players.json', size: '< 1 MB', category: 'config' },
  { id: 'logs', name: 'logs/ (Console history & crash reports)', size: '~12 MB', category: 'logs' },
];

export const BackupManager: React.FC = () => {
  const {
    activeServer,
    createBackup,
    restoreBackup,
    deleteBackup,
    togglePinBackup,
    createBackupRule,
    updateBackupRule,
    deleteBackupRule,
    runBackupRule,
    wrapperSettings,
  } = useServer();
  const { canPerformAction } = useAuth();

  // State
  const [activeTab, setActiveTab] = useState<'rules' | 'archives'>('rules');
  const [runningRuleId, setRunningRuleId] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [restoreConfirmBackup, setRestoreConfirmBackup] = useState<BackupRecord | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // Create / Edit Rule Modal state
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleName, setRuleName] = useState('');
  const [ruleDestPath, setRuleDestPath] = useState(
    wrapperSettings.backupsDirectory || `D:/MinecraftBackups/${activeServer.name.replace(/\s+/g, '')}`
  );
  const [ruleRetention, setRuleRetention] = useState<number>(8);
  const [ruleCompression, setRuleCompression] = useState<'fast' | 'normal' | 'maximum'>('normal');
  const [ruleIncludedPaths, setRuleIncludedPaths] = useState<string[]>([
    'world',
    'world_nether',
    'world_the_end',
    'mods',
    'config',
    'server.properties',
    'whitelist.json',
  ]);
  const [ruleNotes, setRuleNotes] = useState('');

  const backupRules = activeServer.backupRules || [];
  const backups = activeServer.backups || [];
  const totalBackupBytes = backups.reduce((acc, b) => acc + b.sizeBytes, 0);

  const handleOpenCreateModal = () => {
    setEditingRuleId(null);
    setRuleName('Full World & Config Snapshot');
    setRuleDestPath(
      wrapperSettings.backupsDirectory || `D:/MinecraftBackups/${activeServer.name.replace(/\s+/g, '')}`
    );
    setRuleRetention(8);
    setRuleCompression('normal');
    setRuleIncludedPaths([
      'world',
      'world_nether',
      'world_the_end',
      'mods',
      'config',
      'server.properties',
      'whitelist.json',
    ]);
    setRuleNotes('Automated full snapshot rule.');
    setIsRuleModalOpen(true);
  };

  const handleOpenEditModal = (rule: BackupRule) => {
    setEditingRuleId(rule.id);
    setRuleName(rule.name);
    setRuleDestPath(rule.destinationPath);
    setRuleRetention(rule.retentionCount);
    setRuleCompression(rule.compressionLevel);
    setRuleIncludedPaths(rule.includedPaths);
    setRuleNotes(rule.notes || '');
    setIsRuleModalOpen(true);
  };

  const handleSaveRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) return;

    if (editingRuleId) {
      updateBackupRule(activeServer.id, editingRuleId, {
        name: ruleName.trim(),
        destinationPath: ruleDestPath.trim() || '/Backups',
        retentionCount: ruleRetention,
        compressionLevel: ruleCompression,
        includedPaths: ruleIncludedPaths,
        notes: ruleNotes.trim() || undefined,
      });
      setStatusNotice(`Backup rule "${ruleName.trim()}" updated successfully.`);
    } else {
      createBackupRule(activeServer.id, {
        name: ruleName.trim(),
        destinationPath: ruleDestPath.trim() || '/Backups',
        retentionCount: ruleRetention,
        compressionLevel: ruleCompression,
        includedPaths: ruleIncludedPaths,
        notes: ruleNotes.trim() || undefined,
      });
      setStatusNotice(`Created new backup rule "${ruleName.trim()}".`);
    }

    setIsRuleModalOpen(false);
    setTimeout(() => setStatusNotice(null), 4000);
  };

  const handleTogglePath = (pathId: string) => {
    setRuleIncludedPaths((prev) =>
      prev.includes(pathId) ? prev.filter((p) => p !== pathId) : [...prev, pathId]
    );
  };

  const handleRunRule = async (rule: BackupRule) => {
    setRunningRuleId(rule.id);
    setStatusNotice(null);
    try {
      const created = await runBackupRule(activeServer.id, rule.id);
      setStatusNotice(`Backup archive '${created.name}' created and saved to '${rule.destinationPath}'!`);
      setActiveTab('archives');
      setTimeout(() => setStatusNotice(null), 5000);
    } catch {
      setStatusNotice('Failed to run backup rule.');
    } finally {
      setRunningRuleId(null);
    }
  };

  const handleConfirmRestore = async () => {
    if (!restoreConfirmBackup) return;
    setIsRestoring(true);
    try {
      await restoreBackup(activeServer.id, restoreConfirmBackup.id);
      setStatusNotice(`Server state successfully restored to snapshot '${restoreConfirmBackup.name}'.`);
      setRestoreConfirmBackup(null);
      setTimeout(() => setStatusNotice(null), 4000);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDownloadBackup = (bk: BackupRecord) => {
    const data = JSON.stringify(
      {
        backupId: bk.id,
        serverName: activeServer.name,
        minecraftVersion: bk.minecraftVersion,
        loader: bk.loader,
        ruleName: bk.ruleName,
        destinationPath: bk.destinationPath,
        includedItems: bk.includedItems,
        createdAt: bk.createdAt,
        sizeBytes: bk.sizeBytes,
        serverProperties: activeServer.properties,
        installedMods: activeServer.mods,
      },
      null,
      2
    );
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${bk.name}.crafty-backup.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto w-full space-y-6">
      {/* Top Header */}
      <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Archive className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <span>Backup Rules & Archives</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950/70 text-emerald-400 border border-emerald-800/50 font-mono font-medium">
                  Hot-Snapshot Engine
                </span>
              </h1>
              <p className="text-xs text-zinc-400">
                Configure destination drives, file exclusion rules, and retention policies for <strong className="text-zinc-200">{activeServer.name}</strong>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800 text-xs">
            <button
              onClick={() => setActiveTab('rules')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                activeTab === 'rules'
                  ? 'bg-zinc-800 text-emerald-400 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Backup Rules ({backupRules.length})
            </button>
            <button
              onClick={() => setActiveTab('archives')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                activeTab === 'archives'
                  ? 'bg-zinc-800 text-emerald-400 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Created Archives ({backups.length})
            </button>
          </div>

          {canPerformAction('manage_backups') && activeTab === 'rules' && (
            <button
              onClick={handleOpenCreateModal}
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create Backup Rule</span>
            </button>
          )}
        </div>
      </div>

      {statusNotice && (
        <div className="p-3.5 bg-emerald-950/70 border border-emerald-800 text-xs text-emerald-300 rounded-xl flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusNotice}</span>
        </div>
      )}

      {/* Summary Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-4 space-y-1">
          <span className="text-[11px] text-zinc-500 uppercase font-mono">Configured Rules</span>
          <p className="text-xl font-bold font-mono text-zinc-100">{backupRules.length} Profiles</p>
          <p className="text-[11px] text-zinc-400 font-mono">Custom destinations & retentions</p>
        </div>

        <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-4 space-y-1">
          <span className="text-[11px] text-zinc-500 uppercase font-mono">Stored Snapshots</span>
          <p className="text-xl font-bold font-mono text-emerald-400">{backups.length} Archives</p>
          <p className="text-[11px] text-zinc-400 font-mono">{backups.filter((b) => b.isPinned).length} pinned snapshots</p>
        </div>

        <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-4 space-y-1">
          <span className="text-[11px] text-zinc-500 uppercase font-mono">Storage Utilized</span>
          <p className="text-xl font-bold font-mono text-zinc-100">{formatFileSize(totalBackupBytes)}</p>
          <p className="text-[11px] text-zinc-400 font-mono">Compressed ZIP archives</p>
        </div>

        <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-4 space-y-1">
          <span className="text-[11px] text-zinc-500 uppercase font-mono">Default Location</span>
          <p className="text-xs font-bold font-mono text-zinc-200 truncate" title={wrapperSettings.backupsDirectory || '/Backups'}>
            {wrapperSettings.backupsDirectory || '/Backups'}
          </p>
          <p className="text-[11px] text-zinc-400 font-mono">Overrideable per rule</p>
        </div>
      </div>

      {/* TAB 1: BACKUP RULES */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-200 uppercase font-mono tracking-wider flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <span>Backup Rules & Profiles ({backupRules.length})</span>
            </h2>
          </div>

          {backupRules.length === 0 ? (
            <div className="p-10 text-center bg-[#11151c] border border-dashed border-zinc-800 rounded-2xl space-y-3">
              <Archive className="w-10 h-10 text-zinc-600 mx-auto" />
              <p className="text-sm font-semibold text-zinc-300">No Backup Rules Configured</p>
              <p className="text-xs text-zinc-500 max-w-md mx-auto">
                Create a backup rule to specify where files go (e.g. secondary drive), retention limits, and which world/mod files to compress.
              </p>
              <button
                onClick={handleOpenCreateModal}
                className="mt-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Rule</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {backupRules.map((rule) => {
                const isRunning = runningRuleId === rule.id;
                const matchingArchives = backups.filter((b) => b.ruleId === rule.id);

                return (
                  <div
                    key={rule.id}
                    className="bg-[#11151c] border border-zinc-800 hover:border-zinc-700/80 rounded-2xl p-5 space-y-4 transition-all shadow-xl flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      {/* Top Bar */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                            <h3 className="font-bold text-base text-zinc-100">{rule.name}</h3>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 pt-0.5">
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-emerald-400 font-semibold flex items-center gap-1">
                              <Folder className="w-3 h-3" />
                              <span className="truncate max-w-[240px]">{rule.destinationPath}</span>
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                              Keep max {rule.retentionCount} backups
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {canPerformAction('manage_backups') && (
                            <>
                              <button
                                onClick={() => handleOpenEditModal(rule)}
                                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition-colors cursor-pointer"
                                title="Edit Rule"
                              >
                                <Settings className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => deleteBackupRule(activeServer.id, rule.id)}
                                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-rose-950/40 text-zinc-500 hover:text-rose-400 border border-zinc-800 transition-colors cursor-pointer"
                                title="Delete Rule"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Included Files Chips */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] text-zinc-500 uppercase font-mono font-semibold block">
                          Included Files ({rule.includedPaths.length} items):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {rule.includedPaths.map((p) => (
                            <span
                              key={p}
                              className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900/90 border border-zinc-800 text-zinc-300 flex items-center gap-1"
                            >
                              <FileText className="w-2.5 h-2.5 text-emerald-400" />
                              <span>{p}</span>
                            </span>
                          ))}
                        </div>
                      </div>

                      {rule.notes && (
                        <p className="text-xs text-zinc-400 leading-relaxed italic bg-zinc-900/40 p-2 rounded-lg border border-zinc-800/60">
                          "{rule.notes}"
                        </p>
                      )}
                    </div>

                    {/* Footer Execution Bar */}
                    <div className="pt-3 border-t border-zinc-800 flex items-center justify-between gap-3">
                      <div className="text-[11px] font-mono text-zinc-400">
                        <span>Last Run: </span>
                        <strong className="text-zinc-200">
                          {rule.lastRunAt ? new Date(rule.lastRunAt).toLocaleDateString() : 'Never'}
                        </strong>
                        <span className="text-zinc-500 ml-2">({matchingArchives.length} archives stored)</span>
                      </div>

                      {canPerformAction('manage_backups') && (
                        <button
                          onClick={() => handleRunRule(rule)}
                          disabled={isRunning}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-emerald-950/40 flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          {isRunning ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Compressing...</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Run Backup Now</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CREATED ARCHIVES */}
      {activeTab === 'archives' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-200 uppercase font-mono tracking-wider flex items-center gap-2">
              <Archive className="w-4 h-4 text-emerald-400" />
              <span>Snapshot Archives ({backups.length})</span>
            </h2>
          </div>

          {backups.length === 0 ? (
            <div className="p-10 text-center bg-[#11151c] border border-dashed border-zinc-800 rounded-2xl space-y-3">
              <Archive className="w-10 h-10 text-zinc-600 mx-auto" />
              <p className="text-sm font-semibold text-zinc-300">No Archives Found</p>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                No backup archives have been generated yet. Run one of your configured Backup Rules to create a snapshot.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {backups.map((bk) => (
                <div
                  key={bk.id}
                  className={`p-4 bg-[#11151c] border rounded-xl flex flex-wrap items-center justify-between gap-4 transition-all ${
                    bk.isPinned ? 'border-emerald-500/40 bg-emerald-950/10' : 'border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-zinc-100">{bk.name}</h4>
                      {bk.isPinned && (
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/40 flex items-center gap-1 font-semibold">
                          <Pin className="w-3 h-3" />
                          <span>Pinned</span>
                        </span>
                      )}
                      {bk.ruleName && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                          Rule: {bk.ruleName}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-zinc-400 font-mono flex flex-wrap items-center gap-3">
                      <span>{new Date(bk.createdAt).toLocaleString()}</span>
                      <span>·</span>
                      <span className="text-zinc-200 font-bold">{formatFileSize(bk.sizeBytes)}</span>
                      <span>·</span>
                      <span>MC {bk.minecraftVersion} ({bk.loader.toUpperCase()})</span>
                      {bk.destinationPath && (
                        <>
                          <span>·</span>
                          <span className="text-emerald-400 truncate max-w-[250px]">📁 {bk.destinationPath}</span>
                        </>
                      )}
                    </p>

                    {bk.notes && <p className="text-xs text-zinc-500 italic">"{bk.notes}"</p>}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => togglePinBackup(activeServer.id, bk.id)}
                      className={`p-2 rounded-lg border text-xs transition-colors cursor-pointer ${
                        bk.isPinned
                          ? 'bg-emerald-600/20 text-emerald-400 border-emerald-600/40 hover:bg-emerald-600/30'
                          : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:bg-zinc-800'
                      }`}
                      title={bk.isPinned ? 'Unpin backup (can be pruned)' : 'Pin backup (never auto-deleted)'}
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDownloadBackup(bk)}
                      className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-xs transition-colors cursor-pointer"
                      title="Download backup manifest"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    {canPerformAction('manage_backups') && (
                      <>
                        <button
                          onClick={() => setRestoreConfirmBackup(bk)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600 text-amber-400 hover:text-white border border-amber-600/30 text-xs font-semibold transition-colors cursor-pointer"
                          title="Restore server state from this snapshot"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Restore</span>
                        </button>

                        <button
                          onClick={() => deleteBackup(activeServer.id, bk.id)}
                          className="p-2 rounded-lg bg-zinc-900 hover:bg-rose-950/40 text-zinc-500 hover:text-rose-400 border border-zinc-800 text-xs transition-colors cursor-pointer"
                          title="Delete archive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT BACKUP RULE MODAL */}
      {isRuleModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#11151c] border border-zinc-800 rounded-2xl w-full max-w-xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-100">
                    {editingRuleId ? 'Edit Backup Rule' : 'Configure New Backup Rule'}
                  </h3>
                  <p className="text-xs text-zinc-400">Define destinations, retention limits, and compressed folders</p>
                </div>
              </div>
              <button
                onClick={() => setIsRuleModalOpen(false)}
                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="p-5 space-y-4 overflow-y-auto">
              {/* Rule Name */}
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-300 font-semibold block">Rule / Profile Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Secondary Drive Full Archive"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 font-medium"
                />
              </div>

              {/* Destination Path */}
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-300 font-semibold block flex items-center justify-between">
                  <span>Destination Folder Path (Local or External Drive)</span>
                  <span className="text-[10px] text-zinc-500 font-mono">Separate disk supported</span>
                </label>
                <div className="relative">
                  <Folder className="w-4 h-4 text-emerald-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. D:/MinecraftBackups/Survival or /mnt/backups/smp"
                    value={ruleDestPath}
                    onChange={(e) => setRuleDestPath(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Retention & Compression */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-300 font-semibold block">Retention Limit (Auto-Prune)</label>
                  <select
                    value={ruleRetention}
                    onChange={(e) => setRuleRetention(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 font-mono"
                  >
                    <option value={3}>Keep latest 3 backups</option>
                    <option value={5}>Keep latest 5 backups</option>
                    <option value={8}>Keep latest 8 backups</option>
                    <option value={12}>Keep latest 12 backups</option>
                    <option value={20}>Keep latest 20 backups</option>
                    <option value={50}>Keep latest 50 backups</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-300 font-semibold block">Compression Level</label>
                  <select
                    value={ruleCompression}
                    onChange={(e) => setRuleCompression(e.target.value as any)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 font-mono"
                  >
                    <option value="fast">Fast (Lower CPU usage)</option>
                    <option value="normal">Standard (Balanced ZIP)</option>
                    <option value="maximum">Maximum (Smallest file size)</option>
                  </select>
                </div>
              </div>

              {/* Checkboxes for Server Files / Folders */}
              <div className="space-y-2 pt-1">
                <label className="text-xs text-zinc-300 font-semibold block flex items-center justify-between">
                  <span>Select Server Files to Include in ZIP</span>
                  <span className="text-[10px] text-emerald-400 font-mono">
                    {ruleIncludedPaths.length} items checked
                  </span>
                </label>

                <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3 space-y-2 max-h-48 overflow-y-auto">
                  {AVAILABLE_BACKUP_TARGETS.map((target) => {
                    const isChecked = ruleIncludedPaths.includes(target.id);
                    return (
                      <label
                        key={target.id}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs font-mono ${
                          isChecked ? 'bg-zinc-800/80 text-zinc-100 border border-emerald-500/40' : 'hover:bg-zinc-800/40 text-zinc-400 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleTogglePath(target.id)}
                            className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                          />
                          <span className="font-medium text-zinc-200">{target.name}</span>
                        </div>
                        <span className="text-[10px] text-zinc-500">{target.size}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-300 font-semibold block">Notes / Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Created for external NAS backup"
                  value={ruleNotes}
                  onChange={(e) => setRuleNotes(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsRuleModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold border border-zinc-800 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/40 cursor-pointer transition-colors"
                >
                  {editingRuleId ? 'Save Rule Changes' : 'Create Backup Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESTORE CONFIRMATION MODAL */}
      {restoreConfirmBackup && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#11151c] border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-100">Restore Server Snapshot?</h3>
                <p className="text-xs text-zinc-400">World & configuration rollback</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Restoring from <strong className="text-white font-mono">{restoreConfirmBackup.name}</strong> will overwrite current world regions, playerdata, and configurations with the archived state.
              The server will be safely stopped before extraction.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setRestoreConfirmBackup(null)}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold border border-zinc-800 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRestore}
                disabled={isRestoring}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-950/40 cursor-pointer transition-colors flex items-center gap-1.5"
              >
                {isRestoring ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Extracting...</span>
                  </>
                ) : (
                  <span>Confirm Restore</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
