import React, { useState } from 'react';
import {
  Server,
  Play,
  Square,
  RotateCw,
  Skull,
  Bell,
  User as UserIcon,
  LogOut,
  ChevronDown,
  Shield,
  Plus,
  RefreshCw,
  Sparkles,
  Settings,
  UserCheck,
  Moon,
  DownloadCloud,
  CheckCircle2,
  Loader2,
  Trash2,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';
import { useServer } from '../../context/ServerContext';
import { useAuth } from '../../context/AuthContext';
import { MmsmLogo } from '../common/MmsmLogo';
import { ActiveTab } from './Sidebar';

interface NavbarProps {
  isServerSelected: boolean;
  onNavigateToDashboard: () => void;
  onOpenCreateModal: () => void;
  onOpenLoaderUpdate: () => void;
  onSelectServerFromNav?: (serverId: string) => void;
  onOpenProfileModal?: () => void;
  onOpenWrapperSettings?: () => void;
  onNavigateToTab?: (serverId: string, tab: ActiveTab) => void;
  onNavigateToUserManagement?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  isServerSelected,
  onNavigateToDashboard,
  onOpenCreateModal,
  onOpenLoaderUpdate,
  onSelectServerFromNav,
  onOpenProfileModal,
  onOpenWrapperSettings,
  onNavigateToTab,
  onNavigateToUserManagement,
}) => {
  const {
    servers,
    activeServer,
    setActiveServerId,
    startServer,
    stopServer,
    restartServer,
    killServer,
    wakeServer,
    alerts,
    dismissAlert,
    dismissAllAlerts,
    downloads,
    clearCompletedDownloads,
  } = useServer();
  const { currentUser, logout, canPerformAction } = useAuth();

  const [serverDropdownOpen, setServerDropdownOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Close all open dropdowns when clicking outside
  const hasOpenDropdown = serverDropdownOpen || alertsOpen || downloadsOpen || userMenuOpen;
  const closeAllDropdowns = () => {
    setServerDropdownOpen(false);
    setAlertsOpen(false);
    setDownloadsOpen(false);
    setUserMenuOpen(false);
  };

  // Exclude archived servers from fleet count and online calculation
  const nonArchivedServers = servers.filter((s) => !s.isArchived);
  const runningCount = nonArchivedServers.filter((s) => s.status === 'online').length;
  const activeDownloads = downloads.filter((d) => d.status === 'downloading' || d.status === 'installing');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-emerald-500';
      case 'starting':
      case 'stopping':
      case 'backing_up':
        return 'bg-amber-500 animate-pulse';
      case 'sleeping':
        return 'bg-indigo-400 animate-pulse';
      case 'crashed':
        return 'bg-rose-500';
      default:
        return 'bg-zinc-600';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'online':
        return 'Online';
      case 'starting':
        return 'Starting...';
      case 'stopping':
        return 'Stopping...';
      case 'backing_up':
        return 'Backing Up...';
      case 'sleeping':
        return '💤 Sleeping';
      case 'crashed':
        return 'Crashed';
      default:
        return 'Offline';
    }
  };

  return (
    <header className="h-16 bg-[#11151c] border-b border-zinc-800/80 px-4 md:px-6 flex items-center justify-between select-none sticky top-0 z-40">
      {/* Click-away backdrop overlay to close all open dropdowns */}
      {hasOpenDropdown && (
        <div
          className="fixed inset-0 z-40 bg-transparent"
          onClick={closeAllDropdowns}
        />
      )}
      {/* Brand & Fleet / Server Switcher */}
      <div className="flex items-center gap-3 md:gap-5">
        <button
          onClick={onNavigateToDashboard}
          className="flex items-center gap-2.5 text-left cursor-pointer group"
          title="Return to Dashboard"
        >
          <MmsmLogo size={36} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base text-zinc-100 tracking-tight group-hover:text-emerald-400 transition-colors font-mono">
                MMSM
              </span>
              <span className="text-[10px] uppercase font-mono tracking-wider px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/50 text-emerald-400 font-semibold">
                v2.5
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 hidden sm:block">
              MrHaydenn's Minecraft Server Manager
            </p>
          </div>
        </button>

        {/* Server Picker Dropdown (when inside server view or for quick switch) */}
        {isServerSelected && activeServer && (
          <div className="relative">
            <button
              onClick={() => setServerDropdownOpen(!serverDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-200 transition-colors cursor-pointer"
            >
              <span className={`w-2 h-2 rounded-full ${getStatusColor(activeServer.status)}`} />
              <span className="font-medium truncate max-w-[140px] md:max-w-[180px]">
                {activeServer.name}
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">:{activeServer.port}</span>
              <ChevronDown className="w-3 h-3 text-zinc-400 ml-0.5" />
            </button>

            {serverDropdownOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-72 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95">
                <div className="px-2.5 py-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Switch Instance ({servers.length})</span>
                  <button
                    onClick={() => {
                      setServerDropdownOpen(false);
                      onNavigateToDashboard();
                    }}
                    className="text-emerald-400 hover:underline cursor-pointer lowercase font-normal"
                  >
                    dashboard
                  </button>
                </div>

                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {servers.map((srv) => (
                    <button
                      key={srv.id}
                      onClick={() => {
                        setActiveServerId(srv.id);
                        if (onSelectServerFromNav) onSelectServerFromNav(srv.id);
                        setServerDropdownOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                        srv.id === activeServer.id
                          ? 'bg-zinc-800 text-zinc-100'
                          : 'hover:bg-zinc-800/60 text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${getStatusColor(srv.status)}`} />
                        <div className="truncate">
                          <p className="text-xs font-medium truncate">{srv.name}</p>
                          <p className="text-[10px] text-zinc-400 font-mono">
                            {srv.loader.toUpperCase()} · Port {srv.port}
                          </p>
                        </div>
                      </div>
                      {srv.status === 'online' && (
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-800/40">
                          {srv.players.filter((p) => p.online).length} online
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="border-t border-zinc-800/80 mt-1.5 pt-1.5">
                  <button
                    onClick={() => {
                      setServerDropdownOpen(false);
                      onOpenCreateModal();
                    }}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 text-xs font-medium border border-emerald-600/20 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create New Server</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Middle: Power Controls if inside server view */}
      {isServerSelected ? (
        <div className="hidden lg:flex items-center gap-2 bg-zinc-900/80 border border-zinc-800/90 rounded-lg p-1">
          <div className="flex items-center gap-2 px-2.5 text-xs">
            <span className={`w-2 h-2 rounded-full ${getStatusColor(activeServer.status)}`} />
            <span className="font-medium text-zinc-200">{getStatusLabel(activeServer.status)}</span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-400 font-mono text-[11px]">
              {activeServer.loader.toUpperCase()} {activeServer.loaderVersion}
            </span>
          </div>

          {canPerformAction('server_power') && (
            <div className="flex items-center gap-1 pl-2 border-l border-zinc-800">
              {activeServer.status === 'offline' ? (
                <button
                  onClick={() => startServer()}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Start</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={() => restartServer()}
                    disabled={activeServer.status !== 'online'}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
                    title="Gracefully restart server"
                  >
                    <RotateCw className="w-3 h-3" />
                    <span>Restart</span>
                  </button>
                  <button
                    onClick={() => stopServer()}
                    disabled={activeServer.status === 'stopping'}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-600/30 text-xs font-medium transition-colors cursor-pointer"
                    title="Gracefully stop server"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    <span>Stop</span>
                  </button>
                  <button
                    onClick={() => killServer()}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-rose-950/50 text-zinc-400 hover:text-rose-400 border border-zinc-800 text-xs font-medium transition-colors cursor-pointer"
                    title="Force kill process immediately (SIGKILL)"
                  >
                    <Skull className="w-3 h-3" />
                    <span>Kill</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="hidden md:flex items-center gap-3 text-xs font-mono text-zinc-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>{runningCount} / {nonArchivedServers.length} Servers Online</span>
          </span>
        </div>
      )}

      {/* Right: Downloads Monitor, Notifications & User Menu */}
      <div className="flex items-center gap-2.5">
        {/* Downloads Monitor */}
        <div className="relative">
          <button
            onClick={() => {
              setDownloadsOpen(!downloadsOpen);
              setAlertsOpen(false);
            }}
            className={`relative p-2 rounded-lg border transition-colors cursor-pointer ${
              activeDownloads.length > 0
                ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-400 animate-pulse'
                : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-300'
            }`}
            title="Downloads & Installation Monitor"
          >
            {activeDownloads.length > 0 ? (
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            ) : (
              <DownloadCloud className="w-4 h-4" />
            )}
            {activeDownloads.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-[9px] font-bold text-black flex items-center justify-center">
                {activeDownloads.length}
              </span>
            )}
          </button>

          {downloadsOpen && (
            <div className="absolute right-0 top-full mt-2 w-84 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-2 z-50">
              <div className="px-2.5 py-1.5 text-xs font-semibold text-zinc-200 flex items-center justify-between border-b border-zinc-800">
                <span className="flex items-center gap-1.5 font-bold text-zinc-100">
                  <DownloadCloud className="w-4 h-4 text-emerald-400" />
                  <span>Downloads & Install Tasks</span>
                </span>
                {downloads.length > 0 && (
                  <button
                    onClick={clearCompletedDownloads}
                    className="text-[10px] text-zinc-400 hover:text-zinc-200 cursor-pointer font-mono"
                  >
                    Clear finished
                  </button>
                )}
              </div>

              <div className="py-1 max-h-72 overflow-y-auto space-y-1.5">
                {downloads.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-4 text-center">No active or recent downloads</p>
                ) : (
                  downloads.map((dl) => (
                    <div
                      key={dl.id}
                      className="p-2.5 rounded-lg bg-zinc-800/40 border border-zinc-800 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-zinc-100 truncate max-w-[190px]">
                          {dl.title}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.2 rounded uppercase ${
                            dl.status === 'completed'
                              ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-800/40'
                              : 'bg-cyan-950/70 text-cyan-400 border border-cyan-800/40'
                          }`}
                        >
                          {dl.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                        <span className="truncate max-w-[180px]">{dl.filename}</span>
                        <span>{dl.progressPercent}%</span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            dl.status === 'completed' ? 'bg-emerald-500' : 'bg-cyan-400'
                          }`}
                          style={{ width: `${dl.progressPercent}%` }}
                        />
                      </div>

                      {dl.speedMbps && dl.status !== 'completed' && (
                        <div className="text-[10px] text-zinc-500 font-mono flex items-center justify-between">
                          <span>Speed: {dl.speedMbps} Mbps</span>
                          <span>{dl.startedAt}</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Alerts Bell */}
        <div className="relative">
          <button
            onClick={() => {
              setAlertsOpen(!alertsOpen);
              setDownloadsOpen(false);
            }}
            className="relative p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 transition-colors cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {alerts.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-[9px] font-bold text-black flex items-center justify-center">
                {alerts.length}
              </span>
            )}
          </button>

          {alertsOpen && (
            <div className="absolute right-0 top-full mt-2 w-84 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-2 z-50">
              <div className="px-2.5 py-1.5 text-xs font-semibold text-zinc-300 flex items-center justify-between border-b border-zinc-800">
                <span>System Notifications</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-500 font-normal">{alerts.length} updates</span>
                  {alerts.length > 0 && (
                    <button
                      onClick={dismissAllAlerts}
                      className="text-[10px] font-mono text-emerald-400 hover:underline cursor-pointer"
                    >
                      Dismiss all
                    </button>
                  )}
                </div>
              </div>

              <div className="py-1 max-h-72 overflow-y-auto space-y-1">
                {alerts.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-4 text-center">No new notifications</p>
                ) : (
                  alerts.map((al) => (
                    <div
                      key={al.id}
                      className="p-2.5 rounded-lg bg-zinc-800/40 border border-zinc-800 hover:border-zinc-700 text-xs space-y-1.5 relative transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-emerald-400">{al.title}</span>
                        <button
                          onClick={() => dismissAlert(al.id)}
                          className="text-zinc-500 hover:text-zinc-300 text-[10px] cursor-pointer"
                        >
                          dismiss
                        </button>
                      </div>
                      <p className="text-[11px] text-zinc-300 leading-relaxed">{al.message}</p>

                      <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60">
                        <span className="text-[10px] text-zinc-500">{al.date}</span>
                        {al.targetTab && (
                          <button
                            onClick={() => {
                              const tab = al.targetTab;
                              dismissAlert(al.id);
                              setAlertsOpen(false);
                              if (onNavigateToTab && tab) {
                                onNavigateToTab(al.serverId, tab as ActiveTab);
                              }
                            }}
                            className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                          >
                            <span>Go to {al.targetTab}</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Dedicated Wrapper Settings Gear Icon (Requested beside notifications) */}
        <button
          onClick={onOpenWrapperSettings}
          className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-emerald-400 transition-colors cursor-pointer"
          title="MMSM Wrapper Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* User Account */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-200 transition-colors cursor-pointer"
          >
            <div className="w-6 h-6 rounded-md bg-zinc-800 border border-zinc-700/80 overflow-hidden flex items-center justify-center shrink-0">
              {currentUser?.customAvatarUrl ? (
                <img
                  src={currentUser.customAvatarUrl}
                  alt={currentUser.displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <img
                  src={`https://mc-heads.net/avatar/${currentUser?.avatarSeed || currentUser?.username || 'Steve'}/32`}
                  alt={currentUser?.displayName || 'User'}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'https://mc-heads.net/avatar/MHF_Steve/32';
                  }}
                />
              )}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-medium leading-none">{currentUser?.displayName || 'User'}</p>
              <span className="text-[10px] text-emerald-400 font-mono uppercase">{currentUser?.role}</span>
            </div>
            <ChevronDown className="w-3 h-3 text-zinc-400 ml-0.5" />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-1.5 z-50">
              <div className="px-3 py-2 border-b border-zinc-800">
                <p className="text-xs font-medium text-zinc-200">{currentUser?.displayName}</p>
                <p className="text-[11px] text-zinc-500 font-mono">@{currentUser?.username}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <Shield className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                    {currentUser?.role} Access
                  </span>
                </div>
              </div>

              <div className="py-1 space-y-0.5 border-b border-zinc-800">
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    onOpenProfileModal?.();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800/70 text-xs font-medium transition-colors cursor-pointer text-left"
                >
                  <UserIcon className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Account Profile</span>
                </button>

                {currentUser?.role === 'admin' && onNavigateToUserManagement && (
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      onNavigateToUserManagement();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-purple-300 hover:text-purple-100 hover:bg-purple-950/40 text-xs font-medium transition-colors cursor-pointer text-left"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-purple-400" />
                    <span>Manage Users</span>
                  </button>
                )}
              </div>

              <div className="pt-1">
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-rose-400 hover:bg-rose-950/30 text-xs font-medium transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
