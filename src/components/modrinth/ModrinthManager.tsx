import React, { useState, useEffect, useRef } from 'react';
import {
  Package,
  Search,
  Download,
  RefreshCw,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowUpCircle,
  FileCode,
  HardDrive,
  Layers,
  Check,
  Loader2,
  Info,
  X,
  Upload,
  History,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useServer } from '../../context/ServerContext';
import { useAuth } from '../../context/AuthContext';
import {
  searchModrinth,
  getProjectVersions,
  ModrinthSearchOptions,
} from '../../services/modrinthApi';
import { InstalledMod, ModrinthSearchResult, ModrinthVersion } from '../../types/server';

interface ModrinthManagerProps {
  onOpenCreateServerWithModpack?: (modpack: ModrinthSearchResult) => void;
}

export const ModrinthManager: React.FC<ModrinthManagerProps> = ({
  onOpenCreateServerWithModpack,
}) => {
  const {
    activeServer,
    installMod,
    toggleMod,
    updateMod,
    removeMod,
    checkModUpdatesForServer,
    uploadModFile,
  } = useServer();
  const { canPerformAction } = useAuth();

  const isPluginServer = activeServer.loader === 'paper' || activeServer.loader === 'purpur';
  const isServerRunning = activeServer.status === 'online' || activeServer.status === 'starting';

  const [activeSubTab, setActiveSubTab] = useState<'installed' | 'browse' | 'modpacks'>('installed');
  
  // Search and Pagination state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedLoader, setSelectedLoader] = useState<string>(isPluginServer ? 'paper' : activeServer.loader);
  const [selectedProjectType, setSelectedProjectType] = useState<'mod' | 'plugin' | 'modpack'>(
    isPluginServer ? 'plugin' : 'mod'
  );
  const [sortBy, setSortBy] = useState<'downloads' | 'relevance' | 'updated'>('downloads');
  const [searchResults, setSearchResults] = useState<ModrinthSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTotal, setSearchTotal] = useState(0);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 18;

  // Update check state
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [updateCheckMessage, setUpdateCheckMessage] = useState<string | null>(null);

  // Project details modal
  const [selectedProject, setSelectedProject] = useState<ModrinthSearchResult | null>(null);
  const [projectVersions, setProjectVersions] = useState<ModrinthVersion[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [installingVersionId, setInstallingVersionId] = useState<string | null>(null);
  const [installSuccessMessage, setInstallSuccessMessage] = useState<string | null>(null);

  // Change version modal for installed mods
  const [versionPickerMod, setVersionPickerMod] = useState<InstalledMod | null>(null);
  const [availableModVersions, setAvailableModVersions] = useState<ModrinthVersion[]>([]);
  const [isLoadingModVersions, setIsLoadingModVersions] = useState(false);

  // Upload ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pluginLoaders = ['paper', 'purpur', 'spigot', 'bungeecord', 'velocity'];
  const modLoaders = ['fabric', 'neoforge', 'forge', 'quilt'];
  const currentAvailableLoaders = selectedProjectType === 'plugin' ? pluginLoaders : modLoaders;

  useEffect(() => {
    if (isPluginServer) {
      setSelectedProjectType('plugin');
      setSelectedLoader('paper');
    } else {
      setSelectedProjectType('mod');
      setSelectedLoader(activeServer.loader);
    }
    setPage(1);
  }, [activeServer.loader, isPluginServer]);

  useEffect(() => {
    if (activeSubTab === 'browse' || activeSubTab === 'modpacks') {
      executeSearch(page);
    }
  }, [activeSubTab, selectedCategory, selectedLoader, selectedProjectType, sortBy, page]);

  const executeSearch = async (targetPage = page) => {
    setIsSearching(true);
    try {
      const options: ModrinthSearchOptions = {
        query: searchQuery.trim(),
        projectType: activeSubTab === 'modpacks' ? 'modpack' : selectedProjectType,
        loader: selectedLoader,
        gameVersion: activeServer.minecraftVersion,
        sortBy,
        category: selectedCategory || undefined,
        limit: PAGE_SIZE,
        offset: (targetPage - 1) * PAGE_SIZE,
      };

      const res = await searchModrinth(options);
      setSearchResults(res.hits);
      setSearchTotal(res.total_hits);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    executeSearch(1);
  };

  const handleSwitchProjectType = (type: 'mod' | 'plugin') => {
    setSelectedProjectType(type);
    setPage(1);
    if (type === 'plugin') {
      setSelectedLoader(isPluginServer ? activeServer.loader : 'paper');
    } else {
      setSelectedLoader('fabric');
    }
  };

  const handleCheckUpdates = async () => {
    setIsCheckingUpdates(true);
    setUpdateCheckMessage(null);
    try {
      const count = await checkModUpdatesForServer(activeServer.id);
      if (count > 0) {
        setUpdateCheckMessage(`Found ${count} compatible update(s)! Ready to update below.`);
      } else {
        setUpdateCheckMessage('All installed mods / plugins are up to date with Modrinth.');
      }
    } catch {
      setUpdateCheckMessage('Update check completed.');
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  const handleOneClickUpdate = (mod: InstalledMod) => {
    if (!mod.latestVersionNumber || !mod.latestVersionId) return;
    updateMod(activeServer.id, mod.id, mod.latestVersionNumber, mod.latestVersionId);
  };

  const handleOpenVersionPicker = async (mod: InstalledMod) => {
    setVersionPickerMod(mod);
    setIsLoadingModVersions(true);
    try {
      const versions = await getProjectVersions(mod.id, [activeServer.loader], [activeServer.minecraftVersion]);
      setAvailableModVersions(versions);
    } catch (err) {
      console.error('Failed to get versions:', err);
      setAvailableModVersions([]);
    } finally {
      setIsLoadingModVersions(false);
    }
  };

  const handleSelectModVersion = (ver: ModrinthVersion) => {
    if (!versionPickerMod) return;
    updateMod(activeServer.id, versionPickerMod.id, ver.version_number, ver.id);
    setVersionPickerMod(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadModFile(activeServer.id, file.name, file.size);
    e.target.value = '';
    setUpdateCheckMessage(`Uploaded "${file.name}" into /mods folder successfully.`);
    setTimeout(() => setUpdateCheckMessage(null), 4000);
  };

  const openProjectModal = async (project: ModrinthSearchResult) => {
    setSelectedProject(project);
    setIsLoadingVersions(true);
    setInstallSuccessMessage(null);
    try {
      const versions = await getProjectVersions(project.project_id, [activeServer.loader], [activeServer.minecraftVersion]);
      setProjectVersions(versions);
    } catch (err) {
      console.error(err);
      setProjectVersions([]);
    } finally {
      setIsLoadingVersions(false);
    }
  };

  const handleInstallProjectVersion = (project: ModrinthSearchResult, version?: ModrinthVersion) => {
    const primaryFile = version?.files?.find((f) => f.primary) || version?.files?.[0];
    const filename = primaryFile?.filename || `${project.slug}-${version?.version_number || 'latest'}.jar`;
    const versionNumber = version?.version_number || project.latest_version || '1.0.0';

    setInstallingVersionId(version?.id || 'latest');

    setTimeout(() => {
      const newMod: InstalledMod = {
        id: project.project_id,
        name: project.title,
        slug: project.slug,
        filename,
        installedVersionId: version?.id || 'v-latest',
        installedVersionNumber: versionNumber,
        enabled: true,
        fileSizeBytes: primaryFile?.size || 1500000,
        iconUrl: project.icon_url,
        summary: project.description,
        author: project.author,
        loaders: [activeServer.loader],
        gameVersions: [activeServer.minecraftVersion],
        installedAt: new Date().toISOString(),
      };

      installMod(activeServer.id, newMod);
      setInstallingVersionId(null);
      setInstallSuccessMessage(`Installed ${project.title} (${versionNumber}) into server /mods directory!`);
      setTimeout(() => setInstallSuccessMessage(null), 3000);
    }, 600);
  };

  const isModInstalled = (projectId: string, slug: string) => {
    return activeServer.mods.some((m) => m.id === projectId || m.slug === slug);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${Math.round(bytes / 1024)} KB`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  };

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto w-full space-y-6">
      {/* Hidden file upload input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".jar,.zip"
        className="hidden"
      />

      {/* Header Banner */}
      <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <span>Mods / Plugins</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950/70 text-emerald-400 border border-emerald-800/50 font-mono font-medium">
                  Modrinth Sync
                </span>
              </h1>
              <p className="text-xs text-zinc-400">
                Target server: <span className="text-zinc-200 font-semibold">{activeServer.name}</span> ({activeServer.loader.toUpperCase()} · MC {activeServer.minecraftVersion})
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
          <button
            onClick={() => setActiveSubTab('installed')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeSubTab === 'installed'
                ? 'bg-zinc-800 text-emerald-400 shadow-sm font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Installed ({activeServer.mods.length})
          </button>
          <button
            onClick={() => setActiveSubTab('browse')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeSubTab === 'browse'
                ? 'bg-zinc-800 text-emerald-400 shadow-sm font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Search Modrinth
          </button>
          <button
            onClick={() => setActiveSubTab('modpacks')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeSubTab === 'modpacks'
                ? 'bg-zinc-800 text-emerald-400 shadow-sm font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Modpack Downloader
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: INSTALLED MODS / PLUGINS */}
      {activeSubTab === 'installed' && (
        <div className="space-y-4">
          {/* Actions toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900/60 p-3.5 rounded-xl border border-zinc-800/80">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400">
                Installed: <strong className="text-zinc-200">{activeServer.mods.length}</strong> (
                <span className="text-emerald-400">
                  {activeServer.mods.filter((m) => m.enabled).length} active
                </span>
                )
              </span>
              <span className="text-zinc-600">·</span>
              <span className="text-xs text-zinc-400 font-mono">
                Folder: <code className="text-zinc-300">/mods</code>
              </span>
            </div>

            <div className="flex items-center gap-2">
              {canPerformAction('manage_mods') && (
                <div title={isServerRunning ? 'Stop the server to make this change' : undefined}>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isServerRunning}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      isServerRunning
                        ? 'bg-zinc-900 border-zinc-800 text-zinc-500 opacity-50 cursor-not-allowed'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700 cursor-pointer'
                    }`}
                    title="Upload custom .jar file from computer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload .jar</span>
                  </button>
                </div>
              )}

              <button
                onClick={handleCheckUpdates}
                disabled={isCheckingUpdates || !canPerformAction('manage_mods')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700/80 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdates ? 'animate-spin text-emerald-400' : ''}`} />
                <span>{isCheckingUpdates ? 'Checking...' : 'Check Updates'}</span>
              </button>

              <button
                onClick={() => setActiveSubTab('browse')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-950/40 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Add More</span>
              </button>
            </div>
          </div>

          {updateCheckMessage && (
            <div className="p-3 rounded-lg bg-zinc-800/70 border border-emerald-500/30 text-xs text-emerald-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{updateCheckMessage}</span>
              </div>
              <button onClick={() => setUpdateCheckMessage(null)} className="text-zinc-400 hover:text-zinc-200 text-xs">
                Dismiss
              </button>
            </div>
          )}

          {/* Installed Mods List */}
          {activeServer.mods.length === 0 ? (
            <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-zinc-800/80 flex items-center justify-center mx-auto text-zinc-500">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-200">No Mods or Plugins Installed</h3>
                <p className="text-xs text-zinc-400 max-w-md mx-auto mt-1">
                  Upload your own jar or search Modrinth to install compatible mods or plugins with 1-click.
                </p>
              </div>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold cursor-pointer border border-zinc-700"
                >
                  Upload .jar File
                </button>
                <button
                  onClick={() => setActiveSubTab('browse')}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-950/50 cursor-pointer"
                >
                  Browse Modrinth
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5">
              {activeServer.mods.map((mod) => (
                <div
                  key={mod.id}
                  className={`bg-[#11151c] border rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-4 transition-colors ${
                    mod.enabled ? 'border-zinc-800 hover:border-zinc-700' : 'border-zinc-800/50 opacity-60 bg-zinc-900/40'
                  }`}
                >
                  {/* Left: Icon & Info */}
                  <div className="flex items-center gap-3.5 min-w-[280px] flex-1">
                    {mod.iconUrl ? (
                      <img
                        src={mod.iconUrl}
                        alt={mod.name}
                        className="w-10 h-10 rounded-lg object-contain bg-zinc-900 border border-zinc-800 shrink-0 p-1"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 text-emerald-400">
                        <Package className="w-5 h-5" />
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-zinc-100">{mod.name}</h3>
                        <span className="text-[11px] font-mono text-zinc-400 bg-zinc-800/80 px-1.5 py-0.5 rounded">
                          v{mod.installedVersionNumber}
                        </span>

                        {mod.hasUpdate && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950/70 border border-amber-600/50 text-amber-300 font-semibold flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            Update: v{mod.latestVersionNumber}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-zinc-400 line-clamp-1 max-w-xl">{mod.summary}</p>

                      <div className="flex items-center gap-3 text-[11px] text-zinc-500 font-mono">
                        <span>by {mod.author}</span>
                        <span>·</span>
                        <span>{formatFileSize(mod.fileSizeBytes)}</span>
                        <span>·</span>
                        <span className="text-zinc-400">{mod.filename}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2">
                    {/* Change Version Button */}
                    {canPerformAction('manage_mods') && !mod.id.startsWith('custom-') && (
                      <button
                        onClick={() => handleOpenVersionPicker(mod)}
                        disabled={isServerRunning}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                          isServerRunning
                            ? 'bg-zinc-900 border-zinc-800 text-zinc-600 opacity-50 cursor-not-allowed'
                            : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border-zinc-800 cursor-pointer'
                        }`}
                        title={isServerRunning ? 'Stop the server to make this change' : 'Change / Select specific version from Modrinth'}
                      >
                        <History className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Change Version</span>
                      </button>
                    )}

                    {mod.hasUpdate && canPerformAction('manage_mods') && (
                      <button
                        onClick={() => handleOneClickUpdate(mod)}
                        disabled={isServerRunning}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-colors ${
                          isServerRunning
                            ? 'bg-zinc-800 text-zinc-500 opacity-50 cursor-not-allowed'
                            : 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer'
                        }`}
                        title={isServerRunning ? 'Stop the server to make this change' : 'Update to latest Modrinth release'}
                      >
                        <ArrowUpCircle className="w-3.5 h-3.5" />
                        <span>Update to v{mod.latestVersionNumber}</span>
                      </button>
                    )}

                    {canPerformAction('manage_mods') && (
                      <button
                        onClick={() => toggleMod(activeServer.id, mod.id)}
                        disabled={isServerRunning}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          isServerRunning
                            ? 'bg-zinc-900 text-zinc-600 border-zinc-800 opacity-50 cursor-not-allowed'
                            : mod.enabled
                            ? 'bg-emerald-950/30 text-emerald-300 border-emerald-800/40 hover:bg-emerald-950/50 cursor-pointer'
                            : 'bg-zinc-800/80 text-zinc-400 border-zinc-700 hover:text-zinc-200 cursor-pointer'
                        }`}
                        title={isServerRunning ? 'Stop the server to make this change' : undefined}
                      >
                        {mod.enabled ? (
                          <>
                            <ToggleRight className="w-4 h-4 text-emerald-400" />
                            <span>Enabled</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-4 h-4" />
                            <span>Disabled</span>
                          </>
                        )}
                      </button>
                    )}

                    {canPerformAction('manage_mods') && (
                      <button
                        onClick={() => removeMod(activeServer.id, mod.id)}
                        disabled={isServerRunning}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          isServerRunning
                            ? 'bg-zinc-900 border-zinc-800 text-zinc-600 opacity-50 cursor-not-allowed'
                            : 'bg-zinc-900 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 border-zinc-800 cursor-pointer'
                        }`}
                        title={isServerRunning ? 'Stop the server to make this change' : 'Delete file'}
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

      {/* SUB-TAB 2: BROWSE MODRINTH */}
      {(activeSubTab === 'browse' || activeSubTab === 'modpacks') && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-4 space-y-3">
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    activeSubTab === 'modpacks'
                      ? 'Search Modrinth modpacks...'
                      : selectedProjectType === 'plugin'
                      ? 'Search plugins (e.g., EssentialsX, LuckPerms, Vault, WorldEdit)...'
                      : 'Search mods (e.g., Sodium, Lithium, Chunky, FerriteCore)...'
                  }
                  className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60"
                />
              </div>

              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Search</span>
              </button>
            </form>

            {/* Quick Filters */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-800/60 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                {/* Type Filter */}
                {activeSubTab === 'browse' && (
                  <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setSelectedProjectType('mod')}
                      className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                        selectedProjectType === 'mod'
                          ? 'bg-zinc-800 text-emerald-400 font-semibold'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Mods
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedProjectType('plugin')}
                      className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                        selectedProjectType === 'plugin'
                          ? 'bg-zinc-800 text-emerald-400 font-semibold'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Plugins
                    </button>
                  </div>
                )}

                {/* Loader filters: only show applicable loaders (e.g. plugins only show paper/purpur/spigot/bungeecord/velocity, mods show fabric/neoforge/forge/quilt) */}
                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-500 text-[11px] uppercase font-mono">Loader:</span>
                  {(selectedProjectType === 'plugin' || isPluginServer
                    ? (['paper', 'purpur', 'spigot', 'velocity'] as const)
                    : (['fabric', 'neoforge', 'forge', 'quilt'] as const)
                  ).map((ldr) => (
                    <button
                      key={ldr}
                      type="button"
                      onClick={() => {
                        setSelectedLoader(ldr);
                        setPage(1);
                      }}
                      className={`px-2 py-0.5 rounded text-xs uppercase font-mono transition-colors cursor-pointer ${
                        selectedLoader === ldr
                          ? 'bg-emerald-600 text-white font-semibold'
                          : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                      }`}
                    >
                      {ldr}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-zinc-500 text-[11px] uppercase font-mono">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs rounded-lg px-2.5 py-1 focus:outline-none"
                >
                  <option value="downloads">Most Downloads</option>
                  <option value="relevance">Relevance</option>
                  <option value="updated">Recently Updated</option>
                </select>
              </div>
            </div>
          </div>

          {/* Results Grid */}
          {isSearching ? (
            <div className="py-20 text-center space-y-3">
              <Loader2 className="w-7 h-7 text-emerald-400 animate-spin mx-auto" />
              <p className="text-xs text-zinc-400">Querying Modrinth registry...</p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-12 text-center space-y-3">
              <p className="text-zinc-300 font-semibold text-sm">No results found on Modrinth</p>
              <p className="text-xs text-zinc-500">Try adjusting your query or selecting another loader filter.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {searchResults.map((project) => {
                  const installed = isModInstalled(project.project_id, project.slug);
                  return (
                    <div
                      key={project.project_id}
                      className="bg-[#11151c] border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 flex flex-col justify-between space-y-3 transition-colors"
                    >
                      <div>
                        <div className="flex items-start gap-3">
                          {project.icon_url ? (
                            <img
                              src={project.icon_url}
                              alt={project.title}
                              className="w-12 h-12 rounded-xl object-contain bg-zinc-900 border border-zinc-800 p-1 shrink-0"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center text-emerald-400 shrink-0">
                              <Package className="w-6 h-6" />
                            </div>
                          )}

                          <div className="space-y-0.5 flex-1 min-w-0">
                            <h3
                              onClick={() => openProjectModal(project)}
                              className="font-semibold text-zinc-100 text-sm hover:text-emerald-400 cursor-pointer truncate"
                            >
                              {project.title}
                            </h3>
                            <p className="text-[11px] text-zinc-500 font-mono">by {project.author}</p>
                          </div>
                        </div>

                        <p className="text-xs text-zinc-400 line-clamp-2 mt-2 leading-relaxed">
                          {project.description}
                        </p>

                        <div className="flex flex-wrap items-center gap-1.5 mt-3">
                          {project.categories.slice(0, 3).map((cat) => (
                            <span
                              key={cat}
                              className="text-[10px] text-zinc-400 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded capitalize font-mono"
                            >
                              {cat}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-mono">
                          <span>{formatNumber(project.downloads)} dls</span>
                          <span>·</span>
                          <span>{project.license}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => openProjectModal(project)}
                            className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
                          >
                            Details
                          </button>

                          {installed ? (
                            <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-950/40 text-emerald-400 border border-emerald-800/50 text-xs font-medium">
                              <Check className="w-3 h-3" />
                              <span>Installed</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => handleInstallProjectVersion(project)}
                              disabled={!canPerformAction('manage_mods')}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Install</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination page turn controls */}
              {searchTotal > PAGE_SIZE && (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-zinc-800">
                  <div className="text-xs text-zinc-400 font-mono">
                    Showing <span className="text-zinc-200 font-bold">{(page - 1) * PAGE_SIZE + 1}</span>–
                    <span className="text-zinc-200 font-bold">{Math.min(page * PAGE_SIZE, searchTotal)}</span> of{' '}
                    <span className="text-emerald-400 font-bold">{formatNumber(searchTotal)}</span> total
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setPage((p) => Math.max(1, p - 1));
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      disabled={page <= 1 || isSearching}
                      className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white disabled:opacity-40 disabled:hover:text-zinc-300 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Previous</span>
                    </button>

                    <div className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300">
                      Page <span className="font-bold text-emerald-400">{page}</span> of{' '}
                      <span className="font-bold">{Math.max(1, Math.ceil(searchTotal / PAGE_SIZE))}</span>
                    </div>

                    <button
                      onClick={() => {
                        setPage((p) => Math.min(Math.ceil(searchTotal / PAGE_SIZE), p + 1));
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      disabled={page >= Math.ceil(searchTotal / PAGE_SIZE) || isSearching}
                      className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white disabled:opacity-40 disabled:hover:text-zinc-300 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CHANGE VERSION MODAL FOR INSTALLED MOD */}
      {versionPickerMod && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#11151c] border border-zinc-800 rounded-2xl w-full max-w-xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-zinc-100 text-sm">Change Version: {versionPickerMod.name}</h3>
                <p className="text-xs text-zinc-400 font-mono">
                  Currently installed: v{versionPickerMod.installedVersionNumber}
                </p>
              </div>
              <button
                onClick={() => setVersionPickerMod(null)}
                className="p-1 rounded bg-zinc-900 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-2 overflow-y-auto flex-1">
              {isLoadingModVersions ? (
                <div className="py-12 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  <span>Fetching available versions from Modrinth...</span>
                </div>
              ) : availableModVersions.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-400">
                  <p>No alternate versions available for {activeServer.loader} on Minecraft {activeServer.minecraftVersion}.</p>
                </div>
              ) : (
                availableModVersions.map((v) => {
                  const isCurrent = v.version_number === versionPickerMod.installedVersionNumber;
                  return (
                    <div
                      key={v.id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                        isCurrent
                          ? 'bg-zinc-800/80 border-emerald-500/60'
                          : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="font-bold text-zinc-100">v{v.version_number}</span>
                          <span className="text-[10px] uppercase px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                            {v.version_type}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] text-emerald-400 font-bold">
                              Current
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                          MC: {v.game_versions.slice(0, 3).join(', ')} · Published {v.date_published.substring(0, 10)}
                        </p>
                      </div>

                      {!isCurrent && (
                        <button
                          onClick={() => handleSelectModVersion(v)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors cursor-pointer text-xs"
                        >
                          Switch to this
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* PROJECT DETAILS MODAL */}
      {selectedProject && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#11151c] border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-zinc-800 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                {selectedProject.icon_url && (
                  <img
                    src={selectedProject.icon_url}
                    alt={selectedProject.title}
                    className="w-12 h-12 rounded-xl object-contain bg-zinc-900 border border-zinc-800 p-1"
                  />
                )}
                <div>
                  <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                    <span>{selectedProject.title}</span>
                    <a
                      href={`https://modrinth.com/${selectedProject.project_type}/${selectedProject.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-zinc-500 hover:text-emerald-400"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </h2>
                  <p className="text-xs text-zinc-400">
                    by <strong className="text-zinc-300">{selectedProject.author}</strong> · License: {selectedProject.license}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedProject(null)}
                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 border border-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <h4 className="text-xs font-semibold uppercase font-mono text-zinc-400">Summary</h4>
                <p className="text-xs text-zinc-300 mt-1 leading-relaxed">{selectedProject.description}</p>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase font-mono text-zinc-400">
                  Compatible Versions ({activeServer.loader.toUpperCase()} · MC {activeServer.minecraftVersion})
                </h4>

                <div className="mt-2 space-y-2">
                  {isLoadingVersions ? (
                    <div className="py-6 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                      <span>Fetching releases...</span>
                    </div>
                  ) : projectVersions.length === 0 ? (
                    <div className="p-4 bg-zinc-900 rounded-lg text-xs text-zinc-400 text-center">
                      <p>No exact releases found for {activeServer.loader} on Minecraft {activeServer.minecraftVersion}.</p>
                      <button
                        onClick={() => handleInstallProjectVersion(selectedProject)}
                        className="mt-2 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium"
                      >
                        Install Latest Available Version
                      </button>
                    </div>
                  ) : (
                    projectVersions.map((ver) => (
                      <div
                        key={ver.id}
                        className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-zinc-200">{ver.name || ver.version_number}</span>
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                              {ver.version_type}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                            MC: {ver.game_versions.slice(0, 3).join(', ')} · Published {ver.date_published.substring(0, 10)}
                          </p>
                        </div>

                        <button
                          onClick={() => handleInstallProjectVersion(selectedProject, ver)}
                          disabled={installingVersionId === ver.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {installingVersionId === ver.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                          <span>Install</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
