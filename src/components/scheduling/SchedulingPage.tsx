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
  Sliders,
} from 'lucide-react';
import { useServer } from '../../context/ServerContext';
import { useAuth } from '../../context/AuthContext';
import { ScheduledTask } from '../../types/server';

export const SchedulingPage: React.FC = () => {
  const {
    activeServer,
    addScheduledTask,
    toggleScheduledTask,
    deleteScheduledTask,
    runScheduledTaskNow,
  } = useServer();
  const { canPerformAction } = useAuth();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [taskFilter, setTaskFilter] = useState<'all' | 'backup' | 'restart' | 'command' | 'broadcast' | 'sleep'>('all');
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Form state for creating a scheduled task
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskType, setNewTaskType] = useState<ScheduledTask['type']>('backup');
  const [scheduleMode, setScheduleMode] = useState<'interval' | 'daily_time' | 'preset'>('interval');
  const [intervalNumber, setIntervalNumber] = useState<number>(6);
  const [intervalUnit, setIntervalUnit] = useState<'hours' | 'days' | 'minutes' | 'weeks'>('hours');
  const [dailyTime, setDailyTime] = useState('04:00 AM');
  const [newTaskInterval, setNewTaskInterval] = useState('Every 6 Hours');
  const [newTaskCommand, setNewTaskCommand] = useState('save-all');
  const [selectedBackupRuleId, setSelectedBackupRuleId] = useState<string>(
    activeServer.backupRules?.[0]?.id || ''
  );

  const tasks = activeServer.scheduledTasks || [];
  const backupRules = activeServer.backupRules || [];

  const filteredTasks = tasks.filter((t) => (taskFilter === 'all' ? true : t.type === taskFilter));

  // Compute effective interval string whenever inputs change
  const computeIntervalString = (
    mode: 'interval' | 'daily_time' | 'preset',
    num: number,
    unit: 'hours' | 'days' | 'minutes' | 'weeks',
    time: string
  ) => {
    if (mode === 'daily_time') {
      return `Daily at ${time}`;
    }
    if (mode === 'interval') {
      const capUnit = unit.charAt(0).toUpperCase() + unit.slice(1);
      return `Every ${num} ${num === 1 ? capUnit.replace(/s$/, '') : capUnit}`;
    }
    return newTaskInterval;
  };

  const handleOpenCreateModal = () => {
    setNewTaskType('backup');
    const firstRule = backupRules[0];
    if (firstRule) {
      setSelectedBackupRuleId(firstRule.id);
      setNewTaskName(`Auto-Backup: ${firstRule.name}`);
    } else {
      setNewTaskName('Auto-Backup Task');
    }
    setScheduleMode('interval');
    setIntervalNumber(6);
    setIntervalUnit('hours');
    setNewTaskInterval('Every 6 Hours');
    setNewTaskCommand('save-all');
    setIsCreateModalOpen(true);
  };

  const handleTypeChange = (type: ScheduledTask['type']) => {
    setNewTaskType(type);
    if (type === 'backup') {
      const rule = backupRules.find((r) => r.id === selectedBackupRuleId) || backupRules[0];
      setNewTaskName(rule ? `Auto-Backup: ${rule.name}` : 'Auto-Backup Task');
      setScheduleMode('interval');
      setIntervalNumber(6);
      setIntervalUnit('hours');
      setNewTaskInterval('Every 6 Hours');
    } else if (type === 'restart') {
      setNewTaskName('Daily Graceful Server Restart');
      setScheduleMode('daily_time');
      setDailyTime('04:00 AM');
      setNewTaskInterval('Daily at 04:00 AM');
    } else if (type === 'command') {
      setNewTaskName('Periodic World Save (/save-all)');
      setNewTaskCommand('save-all');
      setScheduleMode('interval');
      setIntervalNumber(30);
      setIntervalUnit('minutes');
      setNewTaskInterval('Every 30 Minutes');
    } else if (type === 'broadcast') {
      setNewTaskName('Server Rules Announcement');
      setNewTaskCommand('say §6[Server] §eDon\'t forget to join our Discord!');
      setScheduleMode('interval');
      setIntervalNumber(1);
      setIntervalUnit('hours');
      setNewTaskInterval('Every 1 Hour');
    } else if (type === 'sleep') {
      setNewTaskName('Nightly Power Saver Standby');
      setScheduleMode('daily_time');
      setDailyTime('02:00 AM');
      setNewTaskInterval('Daily at 02:00 AM');
    }
  };

  const handleBackupRuleChange = (ruleId: string) => {
    setSelectedBackupRuleId(ruleId);
    const rule = backupRules.find((r) => r.id === ruleId);
    if (rule) {
      setNewTaskName(`Auto-Backup: ${rule.name}`);
    }
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskName.trim()) return;

    const matchedRule = newTaskType === 'backup' ? backupRules.find((r) => r.id === selectedBackupRuleId) : undefined;

    addScheduledTask(activeServer.id, {
      name: newTaskName.trim(),
      type: newTaskType,
      cronOrInterval: newTaskInterval,
      command: newTaskType === 'command' || newTaskType === 'broadcast' ? newTaskCommand.trim() : undefined,
      backupRuleId: matchedRule ? matchedRule.id : undefined,
      backupRuleName: matchedRule ? matchedRule.name : undefined,
      enabled: true,
      lastRun: 'Never',
      nextRun: 'In ' + newTaskInterval.toLowerCase(),
    });

    setIsCreateModalOpen(false);
    setSuccessNotice(`Task "${newTaskName.trim()}" scheduled successfully.`);
    setTimeout(() => setSuccessNotice(null), 3500);
  };

  const handleRunNow = (taskId: string, taskName: string) => {
    runScheduledTaskNow(activeServer.id, taskId);
    setSuccessNotice(`Triggered execution for task "${taskName}".`);
    setTimeout(() => setSuccessNotice(null), 3500);
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
                <span>Task Scheduling</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950/70 text-emerald-400 border border-emerald-800/50 font-mono font-medium">
                  Automation Engine
                </span>
              </h1>
              <p className="text-xs text-zinc-400">
                Automated backup routines, scheduled restarts, timed console commands, and inactivity sleep for <strong className="text-zinc-200">{activeServer.name}</strong>
              </p>
            </div>
          </div>
        </div>

        {canPerformAction('execute_commands') && (
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-950/40 cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Scheduled Task</span>
          </button>
        )}
      </div>

      {successNotice && (
        <div className="p-3.5 bg-emerald-950/70 border border-emerald-800 text-xs text-emerald-300 rounded-xl flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* FILTER & TASK LIST */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800 text-xs">
            {(['all', 'backup', 'restart', 'command', 'broadcast', 'sleep'] as const).map((ft) => (
              <button
                key={ft}
                onClick={() => setTaskFilter(ft)}
                className={`px-3 py-1.5 rounded-md font-medium capitalize transition-colors cursor-pointer ${
                  taskFilter === ft ? 'bg-zinc-800 text-emerald-400 font-semibold shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {ft === 'all' ? 'All Tasks' : ft + 's'}
              </button>
            ))}
          </div>

          <span className="text-xs text-zinc-500 font-mono">
            {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''} configured
          </span>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="p-12 text-center bg-[#11151c] border border-dashed border-zinc-800 rounded-2xl space-y-3">
            <Clock className="w-10 h-10 text-zinc-600 mx-auto" />
            <p className="text-sm font-semibold text-zinc-300">No Scheduled Tasks Found</p>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Automate routine operations such as running specific Backup Rules, restarting the JVM, or broadcasting announcements.
            </p>
            <button
              onClick={handleOpenCreateModal}
              className="mt-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create Scheduled Task</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className="p-4 bg-[#11151c] border border-zinc-800 hover:border-zinc-700/80 rounded-xl flex flex-wrap items-center justify-between gap-4 transition-all shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                    {getTypeIcon(task.type)}
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-zinc-100">{task.name}</h4>
                      <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded border font-semibold ${getTypeBadge(task.type)}`}>
                        {task.type}
                      </span>
                    </div>

                    <div className="text-xs text-zinc-400 font-mono flex flex-wrap items-center gap-2">
                      <span className="text-zinc-300 font-semibold">{task.cronOrInterval}</span>
                      {task.backupRuleName && (
                        <>
                          <span>·</span>
                          <span className="text-emerald-400">Rule: {task.backupRuleName}</span>
                        </>
                      )}
                      {task.command && (
                        <>
                          <span>·</span>
                          <code className="text-amber-300 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                            /{task.command}
                          </code>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 font-mono text-xs">
                  <div className="text-right hidden sm:block">
                    <span className="text-[10px] text-zinc-500 block">Next Execution</span>
                    <span className="text-zinc-300 font-semibold">{task.enabled ? task.nextRun : 'Disabled'}</span>
                  </div>

                  {canPerformAction('execute_commands') && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleRunNow(task.id, task.name)}
                        className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Execute Task Immediately"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Run Now</span>
                      </button>

                      <button
                        onClick={() => toggleScheduledTask(activeServer.id, task.id)}
                        className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                          task.enabled
                            ? 'bg-emerald-600/20 text-emerald-400 border-emerald-600/40 hover:bg-emerald-600/30'
                            : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300'
                        }`}
                        title={task.enabled ? 'Pause Task' : 'Enable Task'}
                      >
                        {task.enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                      </button>

                      <button
                        onClick={() => deleteScheduledTask(activeServer.id, task.id)}
                        className="p-1.5 rounded-lg bg-zinc-900 hover:bg-rose-950/40 text-zinc-500 hover:text-rose-400 border border-zinc-800 transition-colors cursor-pointer"
                        title="Delete Task"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CREATE SCHEDULED TASK MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#11151c] border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-100">Schedule Automation Task</h3>
                  <p className="text-xs text-zinc-400">Select task trigger, interval, and rule targets</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-5 space-y-4">
              {/* Task Type */}
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-300 font-semibold block">Task Operation</label>
                <div className="grid grid-cols-3 gap-2 text-xs font-medium">
                  {(['backup', 'restart', 'command', 'broadcast', 'sleep'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleTypeChange(t)}
                      className={`p-2 rounded-xl border text-center capitalize transition-colors cursor-pointer ${
                        newTaskType === t
                          ? 'bg-zinc-800 border-emerald-500 text-emerald-400 font-bold'
                          : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Specific Backup Rule Selection (When type is 'backup') */}
              {newTaskType === 'backup' && (
                <div className="space-y-1.5 bg-zinc-900/70 p-3.5 rounded-xl border border-zinc-800">
                  <label className="text-xs text-zinc-200 font-semibold block flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <Archive className="w-3.5 h-3.5" />
                      <span>Select Target Backup Rule</span>
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {backupRules.length} rules available
                    </span>
                  </label>

                  {backupRules.length === 0 ? (
                    <div className="p-2 text-xs text-amber-300 bg-amber-950/40 rounded border border-amber-800/40">
                      No Backup Rules configured yet. Please visit the Backups tab to configure destinations and retentions.
                    </div>
                  ) : (
                    <select
                      value={selectedBackupRuleId}
                      onChange={(e) => handleBackupRuleChange(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none focus:border-emerald-500"
                    >
                      {backupRules.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} → {r.destinationPath} (Keep {r.retentionCount})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Task Name */}
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-300 font-semibold block">Task Label</label>
                <input
                  type="text"
                  required
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Command Input (When Command / Broadcast) */}
              {(newTaskType === 'command' || newTaskType === 'broadcast') && (
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-300 font-semibold block">
                    {newTaskType === 'broadcast' ? 'Broadcast Message' : 'Console Command'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={newTaskType === 'broadcast' ? 'say Server maintenance in 10 minutes!' : 'save-all'}
                    value={newTaskCommand}
                    onChange={(e) => setNewTaskCommand(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              {/* Custom Interval / Frequency Selection */}
              <div className="space-y-2 p-3 bg-zinc-900/80 rounded-xl border border-zinc-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-zinc-300 font-semibold block">Execution Schedule & Timing</label>
                  <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded-lg border border-zinc-800 text-[10px]">
                    <button
                      type="button"
                      onClick={() => {
                        setScheduleMode('interval');
                        setNewTaskInterval(computeIntervalString('interval', intervalNumber, intervalUnit, dailyTime));
                      }}
                      className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                        scheduleMode === 'interval'
                          ? 'bg-zinc-800 text-emerald-400 font-bold'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Every X Time
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setScheduleMode('daily_time');
                        setNewTaskInterval(computeIntervalString('daily_time', intervalNumber, intervalUnit, dailyTime));
                      }}
                      className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                        scheduleMode === 'daily_time'
                          ? 'bg-zinc-800 text-emerald-400 font-bold'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Specific Daily Time
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleMode('preset')}
                      className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                        scheduleMode === 'preset'
                          ? 'bg-zinc-800 text-emerald-400 font-bold'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Presets
                    </button>
                  </div>
                </div>

                {scheduleMode === 'interval' && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] text-zinc-400">Repeat Every</label>
                        <input
                          type="number"
                          min="1"
                          max="99"
                          value={intervalNumber}
                          onChange={(e) => {
                            const val = Math.max(1, Number(e.target.value) || 1);
                            setIntervalNumber(val);
                            setNewTaskInterval(computeIntervalString('interval', val, intervalUnit, dailyTime));
                          }}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] text-zinc-400">Time Unit</label>
                        <select
                          value={intervalUnit}
                          onChange={(e) => {
                            const unit = e.target.value as 'hours' | 'days' | 'minutes' | 'weeks';
                            setIntervalUnit(unit);
                            setNewTaskInterval(computeIntervalString('interval', intervalNumber, unit, dailyTime));
                          }}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-emerald-500"
                        >
                          <option value="minutes">Minutes</option>
                          <option value="hours">Hours</option>
                          <option value="days">Days</option>
                          <option value="weeks">Weeks</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {scheduleMode === 'daily_time' && (
                  <div className="space-y-1">
                    <label className="text-[11px] text-zinc-400">Target Time (24h or AM/PM format)</label>
                    <select
                      value={dailyTime}
                      onChange={(e) => {
                        setDailyTime(e.target.value);
                        setNewTaskInterval(`Daily at ${e.target.value}`);
                      }}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="12:00 AM (Midnight)">12:00 AM (Midnight)</option>
                      <option value="02:00 AM">02:00 AM (Low traffic)</option>
                      <option value="04:00 AM">04:00 AM (Daily reset)</option>
                      <option value="06:00 AM">06:00 AM</option>
                      <option value="12:00 PM (Noon)">12:00 PM (Noon)</option>
                      <option value="06:00 PM">06:00 PM (Evening peak)</option>
                      <option value="10:00 PM">10:00 PM</option>
                    </select>
                  </div>
                )}

                {scheduleMode === 'preset' && (
                  <div className="space-y-1">
                    <label className="text-[11px] text-zinc-400">Select Preset Timing</label>
                    <select
                      value={newTaskInterval}
                      onChange={(e) => setNewTaskInterval(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="Every 30 Minutes">Every 30 Minutes</option>
                      <option value="Every 1 Hour">Every 1 Hour</option>
                      <option value="Every 2 Hours">Every 2 Hours</option>
                      <option value="Every 4 Hours">Every 4 Hours</option>
                      <option value="Every 6 Hours">Every 6 Hours</option>
                      <option value="Every 12 Hours">Every 12 Hours</option>
                      <option value="Daily at 04:00 AM">Daily at 04:00 AM</option>
                      <option value="Daily at 02:00 AM">Daily at 02:00 AM</option>
                      <option value="Every 2 Days">Every 2 Days</option>
                      <option value="Weekly on Sunday">Weekly on Sunday</option>
                    </select>
                  </div>
                )}

                <div className="pt-1 flex items-center justify-between text-[11px] font-mono text-zinc-400 border-t border-zinc-800/80">
                  <span>Effective Timing:</span>
                  <span className="text-emerald-400 font-bold">{newTaskInterval}</span>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold border border-zinc-800 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/40 cursor-pointer transition-colors"
                >
                  Schedule Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
