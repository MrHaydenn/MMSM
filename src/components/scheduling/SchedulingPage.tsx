import React, { useState } from 'react';
import {
  Clock,
  Plus,
  Play,
  Trash2,
  CheckCircle2,
  Archive,
  RotateCw,
  Terminal,
  MessageSquare,
  Moon,
  AlertCircle,
  Calendar,
  X,
  ToggleLeft,
  ToggleRight,
  Sparkles,
} from 'lucide-react';
import { useServer } from '../../context/ServerContext';
import { useAuth } from '../../context/AuthContext';
import { ScheduledTask, BackupSchedule } from '../../types/server';

export const SchedulingPage: React.FC = () => {
  const {
    activeServer,
    addScheduledTask,
    toggleScheduledTask,
    deleteScheduledTask,
    runScheduledTaskNow,
    updateBackupSchedule,
  } = useServer();
  const { canPerformAction } = useAuth();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [taskFilter, setTaskFilter] = useState<'all' | 'backup' | 'restart' | 'command' | 'broadcast' | 'sleep'>('all');
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Form state for creating a scheduled task
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskType, setNewTaskType] = useState<ScheduledTask['type']>('command');
  const [newTaskInterval, setNewTaskInterval] = useState('Every 6 Hours');
  const [newTaskCommand, setNewTaskCommand] = useState('save-all');

  const tasks = activeServer.scheduledTasks || [];
  const backupSchedule = activeServer.backupSchedule;

  const filteredTasks = tasks.filter((t) => (taskFilter === 'all' ? true : t.type === taskFilter));

  const handleToggleSchedule = (enabled: boolean) => {
    updateBackupSchedule(activeServer.id, {
      ...backupSchedule,
      enabled,
    });
    setSuccessNotice(`Automated backup schedule ${enabled ? 'activated' : 'paused'}.`);
    setTimeout(() => setSuccessNotice(null), 3000);
  };

  const handleFrequencyChange = (frequency: BackupSchedule['frequency']) => {
    updateBackupSchedule(activeServer.id, {
      ...backupSchedule,
      frequency,
    });
  };

  const handleRetentionChange = (maxKeepBackups: number) => {
    updateBackupSchedule(activeServer.id, {
      ...backupSchedule,
      maxKeepBackups,
    });
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskName.trim()) return;

    addScheduledTask(activeServer.id, {
      name: newTaskName.trim(),
      type: newTaskType,
      cronOrInterval: newTaskInterval,
      command: newTaskType === 'command' || newTaskType === 'broadcast' ? newTaskCommand.trim() : undefined,
      enabled: true,
      lastRun: 'Never',
      nextRun: 'In ' + newTaskInterval.toLowerCase(),
    });

    setIsCreateModalOpen(false);
    setNewTaskName('');
    setNewTaskCommand('save-all');
    setSuccessNotice(`Task "${newTaskName.trim()}" scheduled successfully.`);
    setTimeout(() => setSuccessNotice(null), 3000);
  };

  const handleRunNow = (taskId: string, taskName: string) => {
    runScheduledTaskNow(activeServer.id, taskId);
    setSuccessNotice(`Triggered execution for task "${taskName}".`);
    setTimeout(() => setSuccessNotice(null), 3000);
  };

  const getTypeIcon = (type: ScheduledTask['type']) => {
    switch (type) {
      case 'backup':
        return <Archive className="w-4 h-4 text-emerald-400" />;
      case 'restart':
        return <RotateCw className="w-4 h-4 text-cyan-400" />;
      case 'command':
        return <Terminal className="w-4 h-4 text-amber-400" />;
      case 'broadcast':
        return <MessageSquare className="w-4 h-4 text-purple-400" />;
      case 'sleep':
        return <Moon className="w-4 h-4 text-indigo-400" />;
    }
  };

  const getTypeBadge = (type: ScheduledTask['type']) => {
    switch (type) {
      case 'backup':
        return 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50';
      case 'restart':
        return 'bg-cyan-950/60 text-cyan-400 border-cyan-800/50';
      case 'command':
        return 'bg-amber-950/60 text-amber-400 border-amber-800/50';
      case 'broadcast':
        return 'bg-purple-950/60 text-purple-400 border-purple-800/50';
      case 'sleep':
        return 'bg-indigo-950/60 text-indigo-400 border-indigo-800/50';
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto w-full space-y-6">
      {/* Header */}
      <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <span>Scheduling</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950/70 text-emerald-400 border border-emerald-800/50 font-mono font-medium">
                  Cron & Automation Engine
                </span>
              </h1>
              <p className="text-xs text-zinc-400">
                Automate server backups, scheduled restarts, timed console commands, and inactivity sleep for{' '}
                <strong className="text-zinc-200">{activeServer.name}</strong>
              </p>
            </div>
          </div>
        </div>

        {canPerformAction('execute_commands') && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-950/40 cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Scheduled Task</span>
          </button>
        )}
      </div>

      {successNotice && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* TOP SECTION: Automated Backup Routine */}
      <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <Archive className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-zinc-100">Automated World Backup Schedule</h2>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-mono font-semibold border ${
                backupSchedule.enabled
                  ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700'
              }`}
            >
              {backupSchedule.enabled ? 'ACTIVE' : 'PAUSED'}
            </span>
            {canPerformAction('manage_backups') && (
              <button
                onClick={() => handleToggleSchedule(!backupSchedule.enabled)}
                className="text-xs px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition-colors cursor-pointer"
              >
                {backupSchedule.enabled ? 'Pause Routine' : 'Enable Routine'}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
          <div className="space-y-1.5">
            <label className="text-zinc-400 block font-sans">Snapshot Frequency</label>
            <select
              value={backupSchedule.frequency}
              onChange={(e) => handleFrequencyChange(e.target.value as any)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none"
            >
              <option value="1h">Every 1 Hour (High Safety)</option>
              <option value="6h">Every 6 Hours (Standard)</option>
              <option value="12h">Every 12 Hours</option>
              <option value="24h">Daily (24h at 04:00 AM)</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-zinc-400 block font-sans">Snapshot Retention</label>
            <select
              value={backupSchedule.maxKeepBackups}
              onChange={(e) => handleRetentionChange(Number(e.target.value))}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none"
            >
              <option value={3}>Keep latest 3 snapshots</option>
              <option value={5}>Keep latest 5 snapshots</option>
              <option value={10}>Keep latest 10 snapshots</option>
              <option value={20}>Keep latest 20 snapshots</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-zinc-400 block font-sans">Next Automatic Run</label>
            <div className="p-2 bg-zinc-900/60 rounded-lg border border-zinc-800 text-emerald-400 font-semibold">
              {backupSchedule.enabled ? 'In ~4 hours (04:00 AM UTC)' : 'Schedule Paused'}
            </div>
          </div>
        </div>
      </div>

      {/* FILTER & TASK LIST */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800 text-xs">
            {(['all', 'command', 'restart', 'backup', 'broadcast', 'sleep'] as const).map((ft) => (
              <button
                key={ft}
                onClick={() => setTaskFilter(ft)}
                className={`px-3 py-1.5 rounded-md font-medium capitalize transition-colors cursor-pointer ${
                  taskFilter === ft ? 'bg-zinc-800 text-emerald-400 font-semibold shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {ft === 'all' ? `All Tasks (${tasks.length})` : ft}
              </button>
            ))}
          </div>

          <span className="text-xs text-zinc-500 font-mono">
            {filteredTasks.length} configured automation task(s)
          </span>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-12 text-center space-y-3">
            <Clock className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="text-zinc-300 font-semibold text-sm">No scheduled tasks match the filter</p>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Create a scheduled command (like timed world saves or announcements) or scheduled server restarts.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className={`bg-[#11151c] border rounded-xl p-4 flex flex-col justify-between space-y-3 transition-colors ${
                  task.enabled ? 'border-zinc-800 hover:border-zinc-700' : 'border-zinc-800/50 opacity-60 bg-zinc-900/40'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 shrink-0">
                        {getTypeIcon(task.type)}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-100">{task.name}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded border font-semibold ${getTypeBadge(
                              task.type
                            )}`}
                          >
                            {task.type}
                          </span>
                          <span className="text-xs text-zinc-400 font-mono">
                            {task.cronOrInterval}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleScheduledTask(activeServer.id, task.id)}
                      className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                        task.enabled
                          ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/50'
                          : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                      }`}
                      title={task.enabled ? 'Pause task' : 'Activate task'}
                    >
                      {task.enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                  </div>

                  {task.command && (
                    <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800/80 font-mono text-xs text-emerald-300 flex items-center gap-2 overflow-x-auto">
                      <span className="text-zinc-600 select-none">$</span>
                      <span>{task.command}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono pt-1">
                    <span>Last run: {task.lastRun || 'Never'}</span>
                    <span>Next run: {task.nextRun || 'Pending'}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleRunNow(task.id, task.name)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-800 text-xs font-medium transition-colors cursor-pointer"
                    title="Execute task immediately"
                  >
                    <Play className="w-3 h-3 text-emerald-400 fill-current" />
                    <span>Run Now</span>
                  </button>

                  {canPerformAction('execute_commands') && (
                    <button
                      onClick={() => deleteScheduledTask(activeServer.id, task.id)}
                      className="p-1.5 rounded-lg bg-zinc-900 hover:bg-rose-950/40 text-zinc-500 hover:text-rose-400 border border-zinc-800 transition-colors cursor-pointer"
                      title="Delete scheduled task"
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

      {/* CREATE TASK MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#11151c] border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-100">Schedule New Automation Task</h3>
                  <p className="text-xs text-zinc-400">Execute background commands or maintenance</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:text-zinc-100 border border-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-zinc-300 font-medium">Task Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Nightly Restart, Auto-Save All, Chat Broadcast"
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-zinc-300 font-medium">Task Type</label>
                <select
                  value={newTaskType}
                  onChange={(e) => setNewTaskType(e.target.value as any)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none"
                >
                  <option value="command">Console Command (save-all, whitelist reload, etc.)</option>
                  <option value="restart">Scheduled Graceful Restart</option>
                  <option value="backup">Automated World Snapshot Backup</option>
                  <option value="broadcast">Server Chat Broadcast Announcement</option>
                  <option value="sleep">Put Server To Sleep (Hibernation)</option>
                </select>
              </div>

              {(newTaskType === 'command' || newTaskType === 'broadcast') && (
                <div className="space-y-1.5">
                  <label className="text-zinc-300 font-medium">
                    {newTaskType === 'broadcast' ? 'Announcement Message' : 'Server Command (without leading /)'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={newTaskType === 'broadcast' ? 'say Don\'t forget to vote for the server!' : 'save-all'}
                    value={newTaskCommand}
                    onChange={(e) => setNewTaskCommand(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 font-mono text-emerald-300 placeholder-zinc-500 focus:outline-none"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-zinc-300 font-medium">Frequency / Interval</label>
                <select
                  value={newTaskInterval}
                  onChange={(e) => setNewTaskInterval(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none"
                >
                  <option value="Every 15 Minutes">Every 15 Minutes</option>
                  <option value="Every 30 Minutes">Every 30 Minutes</option>
                  <option value="Every 1 Hour">Every 1 Hour</option>
                  <option value="Every 3 Hours">Every 3 Hours</option>
                  <option value="Every 6 Hours">Every 6 Hours</option>
                  <option value="Every 12 Hours">Every 12 Hours</option>
                  <option value="Daily at 04:00 AM">Daily at 04:00 AM (Off-peak)</option>
                  <option value="Daily at Midnight">Daily at Midnight (00:00 UTC)</option>
                  <option value="Weekly on Sunday">Weekly on Sunday</option>
                </select>
              </div>

              <div className="pt-3 border-t border-zinc-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer shadow-lg shadow-emerald-950/40"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
