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
} from 'lucide-react';
import { useServer } from '../../context/ServerContext';
import { useAuth } from '../../context/AuthContext';
import { BackupRecord, BackupSchedule } from '../../types/server';

export const BackupManager: React.FC = () => {
  const {
    activeServer,
    createBackup,
    restoreBackup,
    deleteBackup,
    togglePinBackup,
    updateBackupSchedule,
  } = useServer();
  const { canPerformAction } = useAuth();

  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [customBackupName, setCustomBackupName] = useState('');
  const [restoreConfirmBackup, setRestoreConfirmBackup] = useState<BackupRecord | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const schedule = activeServer.backupSchedule;
  const backups = activeServer.backups;

  const totalBackupBytes = backups.reduce((acc, b) => acc + b.sizeBytes, 0);

  const handleCreateManualBackup = async () => {
    setIsCreatingBackup(true);
    setStatusNotice(null);
    try {
      const bk = await createBackup(activeServer.id, customBackupName.trim() || undefined, 'manual');
      setCustomBackupName('');
      setStatusNotice(`Created snapshot archive '${bk.name}' successfully!`);
      setTimeout(() => setStatusNotice(null), 4000);
    } catch {
      setStatusNotice('Failed to create backup.');
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (!restoreConfirmBackup) return;
    setIsRestoring(true);
    try {
      await restoreBackup(activeServer.id, restoreConfirmBackup.id);
      setStatusNotice(`Server state successfully restored to '${restoreConfirmBackup.name}'.`);
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

  const handleScheduleToggle = (enabled: boolean) => {
    updateBackupSchedule(activeServer.id, {
      ...schedule,
      enabled,
    });
  };

  const handleFrequencyChange = (frequency: BackupSchedule['frequency']) => {
    updateBackupSchedule(activeServer.id, {
      ...schedule,
      frequency,
    });
  };

  const handleRetentionChange = (maxKeepBackups: number) => {
    updateBackupSchedule(activeServer.id, {
      ...schedule,
      maxKeepBackups,
    });
  };

  const handleIncludeModsToggle = (includeMods: boolean) => {
    updateBackupSchedule(activeServer.id, {
      ...schedule,
      includeMods,
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto w-full space-y-6">
      {/* Header */}
      <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Archive className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <span>Backups</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950/70 text-emerald-400 border border-emerald-800/50 font-mono font-medium">
                  Hot-Snapshot Engine
                </span>
              </h1>
              <p className="text-xs text-zinc-400">
                Create, restore, and preserve snapshots for <strong className="text-zinc-200">{activeServer.name}</strong> · World chunks, player data, server properties & mods
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center gap-2">
            <HardDrive className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-zinc-400">Vault Footprint:</span>
            <span className="font-mono font-semibold text-zinc-200">
              {formatFileSize(totalBackupBytes)} ({backups.length} snapshots)
            </span>
          </div>
        </div>
      </div>

      {statusNotice && (
        <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-800/60 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusNotice}</span>
        </div>
      )}

      {/* Instant Snapshot Creation Card */}
      <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-zinc-100">Create Hot-Snapshot Backup</h2>
          </div>

          <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 flex items-center gap-2 font-mono">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <span>Looking for automated schedules? Set up cron routines in the <strong>Scheduling</strong> page.</span>
          </div>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed max-w-3xl">
          Instantly capture a zero-downtime world flush and archive chunks, inventories, server properties, and installed mods. Creates a restorable snapshot while the server is active or offline.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          <div className="md:col-span-2 space-y-2">
            <label className="text-zinc-400 text-[11px] font-mono uppercase">Snapshot Label / Description (Optional)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customBackupName}
                onChange={(e) => setCustomBackupName(e.target.value)}
                placeholder="e.g. pre-ender-dragon-fight, custom-build-checkpoint, or modpack-v2"
                disabled={isCreatingBackup || !canPerformAction('manage_backups')}
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60 disabled:opacity-50"
              />
              <button
                onClick={handleCreateManualBackup}
                disabled={isCreatingBackup || !canPerformAction('manage_backups')}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-950/40 transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                {isCreatingBackup ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Archiving...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Backup Now</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="space-y-2 bg-zinc-900/60 p-3 rounded-lg border border-zinc-800/80 text-xs text-zinc-400">
            <span className="text-[11px] font-mono uppercase text-zinc-400 font-semibold block">Archive Payload</span>
            <div className="space-y-1 text-[11px] font-mono text-zinc-300">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <Check className="w-3 h-3" />
                <span>World regions & chunk level.dat</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400">
                <Check className="w-3 h-3" />
                <span>Player inventories & statistics</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400">
                <Check className="w-3 h-3" />
                <span>server.properties & config files</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400">
                <Check className="w-3 h-3" />
                <span>{activeServer.mods.length} mod/plugin .jar snapshots</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-3 bg-zinc-900/60 rounded-lg border border-zinc-800/80 text-[11px] text-zinc-500 font-mono flex items-center gap-2">
          <Pin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span>Pinned snapshots are permanently locked and cannot be deleted until unpinned.</span>
        </div>
      </div>

      {/* Backup Archives Table */}
      <div className="bg-[#11151c] border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <span>Stored Server Snapshots ({backups.length})</span>
          </h3>
          <span className="text-xs text-zinc-500 font-mono">Format: .zip tarball</span>
        </div>

        {backups.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 text-xs">
            <Archive className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
            <p>No backups created yet for this server.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/80">
            {backups.map((bk) => (
              <div
                key={bk.id}
                className="p-4 hover:bg-zinc-900/40 transition-colors flex flex-wrap items-center justify-between gap-4 text-xs"
              >
                {/* Info */}
                <div className="flex items-center gap-3">
                  <div
                    onClick={() => togglePinBackup(activeServer.id, bk.id)}
                    className={`p-2 rounded-lg border cursor-pointer transition-colors ${
                      bk.isPinned
                        ? 'bg-amber-950/40 border-amber-800/50 text-amber-400'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-600 hover:text-zinc-300'
                    }`}
                    title={bk.isPinned ? 'Protected from auto-pruning' : 'Click to pin & protect'}
                  >
                    <Pin className="w-4 h-4" />
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-zinc-200">{bk.name}</span>
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                        {bk.type}
                      </span>
                      {bk.isPinned && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-800/40">
                          Pinned
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-500 font-mono">
                      MC {bk.minecraftVersion} ({bk.loader.toUpperCase()}) · Created{' '}
                      {new Date(bk.createdAt).toLocaleString()} · {formatFileSize(bk.sizeBytes)}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownloadBackup(bk)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors cursor-pointer"
                    title="Download snapshot JSON / manifest"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export</span>
                  </button>

                  {canPerformAction('manage_backups') && (
                    <button
                      onClick={() => setRestoreConfirmBackup(bk)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-amber-950/30 text-amber-300 border border-zinc-700 hover:border-amber-800 transition-colors cursor-pointer"
                      title="Rollback server state to this snapshot"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restore</span>
                    </button>
                  )}

                  {canPerformAction('manage_backups') && (
                    <button
                      onClick={() => deleteBackup(activeServer.id, bk.id)}
                      className="p-1.5 rounded-lg bg-zinc-900 hover:bg-rose-950/40 text-zinc-500 hover:text-rose-400 border border-zinc-800 transition-colors cursor-pointer"
                      title="Delete archive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RESTORE CONFIRMATION MODAL */}
      {restoreConfirmBackup && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#11151c] border border-zinc-800 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <RotateCcw className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-bold text-zinc-100 text-base">Restore Server Snapshot?</h3>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                You are about to restore <strong className="text-zinc-200">{activeServer.name}</strong> to snapshot{' '}
                <strong className="text-amber-300">{restoreConfirmBackup.name}</strong> ({new Date(restoreConfirmBackup.createdAt).toLocaleDateString()}).
              </p>
              <p className="text-xs text-zinc-500 mt-2">
                If the server is currently online, it will safely stop, unpack world chunks and configs, and reload.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRestoreConfirmBackup(null)}
                disabled={isRestoring}
                className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRestore}
                disabled={isRestoring}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-amber-950/50"
              >
                {isRestoring ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Extracting...</span>
                  </>
                ) : (
                  <span>Yes, Rollback Server</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
