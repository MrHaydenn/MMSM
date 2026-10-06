import React, { useState } from 'react';
import {
  Terminal,
  Package,
  Activity,
  Folder,
  Users,
  Archive,
  Sliders,
  Sparkles,
  ArrowLeft,
  Menu,
  ChevronLeft,
  AlertCircle,
  RefreshCw,
  UserCheck,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { useServer } from '../../context/ServerContext';
import { useAuth } from '../../context/AuthContext';

export type ActiveTab =
  | 'console'
  | 'mods'
  | 'metrics'
  | 'analytics'
  | 'files'
  | 'players'
  | 'updates'
  | 'backups'
  | 'scheduling'
  | 'config'
  | 'users';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onBackToDashboard: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onBackToDashboard,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const { activeServer } = useServer();
  const { currentUser } = useAuth();

  const modUpdatesCount = activeServer.mods.filter((m) => m.hasUpdate).length;
  const whitelistRequestsCount = (activeServer.whitelistRequests || []).length;

  const navItems = [
    {
      id: 'console' as ActiveTab,
      label: 'Terminal & Console',
      shortLabel: 'Terminal',
      icon: Terminal,
      badge: null,
    },
    {
      id: 'mods' as ActiveTab,
      label: 'Mods / Plugins',
      shortLabel: 'Mods',
      icon: Package,
      badge: modUpdatesCount > 0 ? `${modUpdatesCount}` : null,
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    },
    {
      id: 'metrics' as ActiveTab,
      label: 'Resource Monitor',
      shortLabel: 'Monitor',
      icon: Activity,
      badge: activeServer.status === 'online' ? `${activeServer.telemetry.tps}` : null,
      badgeColor: 'bg-zinc-800 text-zinc-400 border-zinc-700',
    },
    {
      id: 'analytics' as ActiveTab,
      label: 'Analytics',
      shortLabel: 'Analytics',
      icon: TrendingUp,
      badge: null,
    },
    {
      id: 'files' as ActiveTab,
      label: 'File Manager',
      shortLabel: 'Files',
      icon: Folder,
      badge: activeServer.files ? `${activeServer.files.length}` : null,
      badgeColor: 'bg-zinc-800 text-zinc-400 border-zinc-700',
    },
    {
      id: 'players' as ActiveTab,
      label: 'Players',
      shortLabel: 'Players',
      icon: Users,
      badge:
        whitelistRequestsCount > 0
          ? `${whitelistRequestsCount} req`
          : activeServer.players.filter((p) => p.online).length > 0
          ? `${activeServer.players.filter((p) => p.online).length}`
          : null,
      badgeColor:
        whitelistRequestsCount > 0
          ? 'bg-amber-950/80 text-amber-300 border-amber-600/60 font-bold'
          : 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40',
    },
    {
      id: 'updates' as ActiveTab,
      label: 'Loader & Updates',
      shortLabel: 'Updates',
      icon: RefreshCw,
      badge: activeServer.hasLoaderUpdate ? '!' : null,
      badgeColor: 'bg-amber-950/80 text-amber-400 border-amber-600/60 font-bold',
    },
    {
      id: 'backups' as ActiveTab,
      label: 'Backups',
      shortLabel: 'Backups',
      icon: Archive,
      badge: activeServer.backups.length > 0 ? `${activeServer.backups.length}` : null,
      badgeColor: 'bg-zinc-800 text-zinc-400 border-zinc-700',
    },
    {
      id: 'scheduling' as ActiveTab,
      label: 'Scheduling',
      shortLabel: 'Schedule',
      icon: Clock,
      badge:
        (activeServer.scheduledTasks || []).filter((t) => t.enabled).length > 0
          ? `${(activeServer.scheduledTasks || []).filter((t) => t.enabled).length}`
          : null,
      badgeColor: 'bg-zinc-800 text-zinc-400 border-zinc-700',
    },
    {
      id: 'config' as ActiveTab,
      label: 'Server Properties',
      shortLabel: 'Config',
      icon: Sliders,
      badge: null,
    },
  ];

  if (currentUser?.role === 'admin') {
    navItems.push({
      id: 'users' as ActiveTab,
      label: 'User Management',
      shortLabel: 'Users',
      icon: UserCheck,
      badge: 'Admin',
      badgeColor: 'bg-purple-950/60 text-purple-400 border-purple-800/40',
    });
  }

  return (
    <aside
      className={`bg-[#0e1218] border-r border-zinc-800/80 flex flex-col shrink-0 select-none transition-all duration-200 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Return to Main Dashboard + Hamburger Toggle */}
      <div className="p-2.5 border-b border-zinc-800/80 bg-[#11151c]/90 flex items-center gap-2">
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 border border-zinc-800 transition-colors cursor-pointer shrink-0"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse to symbols'}
          >
            {isCollapsed ? <Menu className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}

        {!isCollapsed && (
          <button
            onClick={onBackToDashboard}
            className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-xs font-semibold transition-colors cursor-pointer group truncate"
            title="Return to Main Dashboard"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-emerald-400 group-hover:-translate-x-0.5 transition-transform shrink-0" />
            <span className="truncate">Dashboard</span>
          </button>
        )}
      </div>

      {/* Active Server Info Header */}
      {!isCollapsed ? (
        <div className="p-4 border-b border-zinc-800/60 bg-[#11151c]/50">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              {activeServer.serverIconUrl ? (
                <img
                  src={activeServer.serverIconUrl}
                  alt={activeServer.name}
                  className="w-9 h-9 rounded-lg border border-zinc-700 bg-zinc-800 object-contain p-0.5"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'https://api.iconify.design/pixelarticons:sword.svg';
                  }}
                />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-emerald-950/70 border border-emerald-800/60 flex items-center justify-center text-emerald-400 font-bold text-xs">
                  MC
                </div>
              )}
              <div
                className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-[#11151c] ${
                  activeServer.status === 'online'
                    ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                    : activeServer.status === 'sleeping'
                    ? 'bg-indigo-400'
                    : 'bg-zinc-500'
                }`}
              />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 font-mono">
                Active Instance
              </span>
              <p className="font-semibold text-zinc-100 text-sm truncate leading-tight">{activeServer.name}</p>
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-mono truncate">
                <span className="capitalize">{activeServer.loader}</span>
                <span>·</span>
                <span>:{activeServer.port}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3 border-b border-zinc-800/60 flex justify-center">
          <div className="relative">
            {activeServer.serverIconUrl ? (
              <img
                src={activeServer.serverIconUrl}
                alt={activeServer.name}
                className="w-7 h-7 rounded border border-zinc-700 bg-zinc-800 object-contain p-0.5"
                title={`${activeServer.name} (${activeServer.status})`}
              />
            ) : (
              <div
                className={`w-3 h-3 rounded-full ${
                  activeServer.status === 'online' ? 'bg-emerald-500' : 'bg-zinc-600'
                }`}
                title={`${activeServer.name} (${activeServer.status})`}
              />
            )}
          </div>
        </div>
      )}

      {/* Navigation Links */}
      <nav className="p-2 space-y-1 flex-1 overflow-y-auto">
        {!isCollapsed && (
          <div className="px-3 py-1 text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
            Server Controls
          </div>
        )}

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center ${
                isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
              } rounded-lg text-xs font-medium transition-all cursor-pointer relative group ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50 font-semibold'
                  : 'text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/50'
              }`}
              title={isCollapsed ? item.label : undefined}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-zinc-400'}`} />
                {!isCollapsed && <span>{item.label}</span>}
              </div>

              {item.badge && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                    isCollapsed
                      ? 'absolute -top-1 -right-1 text-[9px] px-1 py-0'
                      : ''
                  } ${
                    isActive ? 'bg-emerald-700/60 text-white border-emerald-400/40' : item.badgeColor
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Modrinth footer note (only when expanded) */}
      {!isCollapsed && (
        <div className="p-3 m-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs space-y-1.5">
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Modrinth Sync Active</span>
          </div>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            {activeServer.mods.length} mods / plugins configured.
          </p>
        </div>
      )}
    </aside>
  );
};
