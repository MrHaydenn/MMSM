import React, { useState, useEffect } from 'react';
import {
  Server,
  Plus,
  Layers,
  Cpu,
  Database,
  ArrowRight,
  ArrowLeft,
  Check,
  X,
  Package,
  Sparkles,
  Search,
  Download,
  AlertCircle,
  Puzzle,
  Loader2,
} from 'lucide-react';
import { useServer } from '../../context/ServerContext';
import { ServerLoader, ModrinthSearchResult } from '../../types/server';
import { getLatestLoaderVersion, fetchMinecraftVersions, fetchLoaderVersionsForLoader } from '../../services/loadersApi';
import { searchModrinth } from '../../services/modrinthApi';

interface CreateServerWizardProps {
  isOpen: boolean;
  onClose: () => void;
  initialModpack?: ModrinthSearchResult | null;
}

export const CreateServerWizard: React.FC<CreateServerWizardProps> = ({
  isOpen,
  onClose,
  initialModpack,
}) => {
  const { servers, createServer, wrapperSettings, installMod } = useServer();

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [port, setPort] = useState<number | ''>(25565);
  const [portWarning, setPortWarning] = useState<string | null>(null);

  const [loader, setLoader] = useState<ServerLoader>('fabric');
  const [minecraftVersion, setMinecraftVersion] = useState('1.21.4');
  const [loaderVersion, setLoaderVersion] = useState('0.16.10');
  const [availableLoaderVersions, setAvailableLoaderVersions] = useState<string[]>([]);
  const [availableMcVersions, setAvailableMcVersions] = useState<string[]>([
    '1.21.4', '1.21.3', '1.21.1', '1.20.4', '1.20.1', '1.19.4', '1.18.2'
  ]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);

  // RAM in GB
  const [minRamGb, setMinRamGb] = useState<number>(wrapperSettings?.defaultMinRamGb || 2);
  const [maxRamGb, setMaxRamGb] = useState<number>(wrapperSettings?.defaultMaxRamGb || 4);

  // Content selection (Modpack vs Individual Mods vs Plugins)
  const [contentType, setContentType] = useState<'modpack' | 'mods' | 'plugins' | 'none'>('none');
  const [contentSearchQuery, setContentSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ModrinthSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedModpack, setSelectedModpack] = useState<ModrinthSearchResult | null>(null);
  const [selectedMods, setSelectedMods] = useState<ModrinthSearchResult[]>([]);

  const isPluginCompatible = loader === 'paper' || loader === 'purpur';
  const isVanilla = loader === 'vanilla';

  // Load Mojang manifest versions on mount
  useEffect(() => {
    fetchMinecraftVersions().then((list) => {
      if (list && list.length > 0) {
        setAvailableMcVersions(list.map((v) => v.id));
      }
    });
  }, []);

  // Fetch available loader versions from APIs whenever loader or mcVersion changes
  useEffect(() => {
    if (loader === 'vanilla') {
      setAvailableLoaderVersions([]);
      setLoaderVersion('vanilla');
      return;
    }

    setIsLoadingVersions(true);
    fetchLoaderVersionsForLoader(loader, minecraftVersion)
      .then((vers) => {
        if (vers && vers.length > 0) {
          setAvailableLoaderVersions(vers);
          setLoaderVersion(vers[0]);
        } else {
          const fallback = getLatestLoaderVersion(loader, minecraftVersion).latestVersion;
          setAvailableLoaderVersions([fallback]);
          setLoaderVersion(fallback);
        }
      })
      .catch(() => {
        const fallback = getLatestLoaderVersion(loader, minecraftVersion).latestVersion;
        setAvailableLoaderVersions([fallback]);
        setLoaderVersion(fallback);
      })
      .finally(() => {
        setIsLoadingVersions(false);
      });
  }, [loader, minecraftVersion]);

  const prevOpenRef = React.useRef(false);

  // Initialize wizard state ONLY when the modal transitions from closed to open
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      setStep(1);
      const rangeStart = wrapperSettings?.portRangeStart || 25560;
      const rangeEnd = wrapperSettings?.portRangeEnd || 25569;
      const takenPorts = servers.map((s) => s.port);

      let freePort: number | null = null;
      for (let p = rangeStart; p <= rangeEnd; p++) {
        if (!takenPorts.includes(p)) {
          freePort = p;
          break;
        }
      }

      if (freePort !== null) {
        setPort(freePort);
        setPortWarning(null);
      } else {
        setPort(25565);
        setPortWarning(`No available ports in configured range (${rangeStart} - ${rangeEnd}). Defaulting to 25565.`);
      }

      setMinRamGb(wrapperSettings?.defaultMinRamGb || 2);
      setMaxRamGb(wrapperSettings?.defaultMaxRamGb || 4);

      if (initialModpack) {
        setName(initialModpack.title);
        setDescription(initialModpack.description);
        setContentType('modpack');
        setSelectedModpack(initialModpack);
      } else {
        setName('');
        setDescription('');
        setContentType('none');
        setSelectedModpack(null);
        setSelectedMods([]);
      }
    }
    prevOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    const latest = getLatestLoaderVersion(loader, minecraftVersion);
    setLoaderVersion(latest.latestVersion);
    if (!isPluginCompatible && contentType === 'plugins') {
      setContentType('mods');
    }
  }, [loader, minecraftVersion]);

  // Live search Modrinth when browsing content
  useEffect(() => {
    if (contentType === 'none') {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const type = contentType === 'modpack' ? 'modpack' : contentType === 'plugins' ? 'plugin' : 'mod';
        const res = await searchModrinth({
          query: contentSearchQuery.trim(),
          projectType: type,
          loader: contentType === 'plugins' ? 'paper' : loader,
          gameVersion: minecraftVersion,
          limit: 12,
        });
        setSearchResults(res.hits);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [contentType, contentSearchQuery, loader, minecraftVersion]);

  if (!isOpen) return null;

  const handleFinish = () => {
    const finalPort = typeof port === 'number' ? port : 25565;
    const minRamMb = Math.round(minRamGb * 1024);
    const maxRamMb = Math.round(maxRamGb * 1024);

    const created = createServer({
      name: name.trim() || 'Minecraft Server',
      description: description.trim(),
      loader,
      loaderVersion,
      minecraftVersion,
      minRamMb,
      ramMb: maxRamMb,
      port: finalPort,
      modpackId: contentType === 'modpack' && selectedModpack ? selectedModpack.project_id : undefined,
    });

    // Install any checked mods
    if (contentType === 'mods' || contentType === 'plugins') {
      selectedMods.forEach((m) => {
        installMod(created.id, {
          id: m.project_id,
          name: m.title,
          slug: m.slug,
          filename: `${m.slug}-${m.latest_version || '1.0'}.jar`,
          installedVersionId: 'v-wizard',
          installedVersionNumber: m.latest_version || '1.0',
          enabled: true,
          fileSizeBytes: 2100000,
          iconUrl: m.icon_url,
          summary: m.description,
          author: m.author,
          loaders: [loader],
          gameVersions: [minecraftVersion],
          installedAt: new Date().toISOString(),
        });
      });
    }

    onClose();
  };

  const toggleSelectMod = (mod: ModrinthSearchResult) => {
    setSelectedMods((prev) => {
      const exists = prev.some((m) => m.project_id === mod.project_id);
      if (exists) {
        return prev.filter((m) => m.project_id !== mod.project_id);
      } else {
        return [...prev, mod];
      }
    });
  };

  const loadersList: { id: ServerLoader; name: string; desc: string }[] = [
    {
      id: 'fabric',
      name: 'Fabric',
      desc: 'Lightweight, modern modding toolchain with maximum optimization and fast updates.',
    },
    {
      id: 'neoforge',
      name: 'NeoForge',
      desc: 'Community-driven successor to Forge for modern tech, magic, and dimension mods.',
    },
    {
      id: 'paper',
      name: 'PaperMC',
      desc: 'High-performance Bukkit/Spigot server implementation designed for SMP and mini-games.',
    },
    {
      id: 'purpur',
      name: 'Purpur',
      desc: 'Drop-in Paper replacement with ultra-customizable gameplay mechanics and high TPS.',
    },
    {
      id: 'quilt',
      name: 'Quilt',
      desc: 'Modular, community-first loader compatible with Fabric mods.',
    },
    {
      id: 'forge',
      name: 'Forge',
      desc: 'Classic modding platform for legacy modpacks and 1.20/1.19 mods.',
    },
    {
      id: 'vanilla',
      name: 'Vanilla',
      desc: 'Official Mojang server without mod or plugin support.',
    },
  ];

  const mcVersions = ['1.21.4', '1.21.3', '1.21.1', '1.20.4', '1.20.1', '1.19.4', '1.18.2'];

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-[#11151c] border border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100">Create New Minecraft Server</h2>
              <p className="text-xs text-zinc-400">Step {step} of 3</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 border border-zinc-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Wizard Steps Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* STEP 1: Basic Information */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-zinc-300 font-medium">Server Display Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. My Modded SMP"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500/60"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-300 font-medium">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short description for dashboard"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500/60"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-zinc-300 font-medium">Server Port</label>
                  <span className="text-[11px] text-zinc-500 font-mono">
                    Auto-allocated from port range ({wrapperSettings?.portRangeStart || 25560} - {wrapperSettings?.portRangeEnd || 25569})
                  </span>
                </div>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(e.target.value ? Number(e.target.value) : '')}
                  placeholder="e.g. 25565"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-emerald-500/60"
                />
                {portWarning && (
                  <p className="text-[11px] text-amber-400 flex items-center gap-1 font-mono">
                    <AlertCircle className="w-3 h-3" />
                    <span>{portWarning}</span>
                  </p>
                )}

                <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-[11px] space-y-1">
                  <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Multiplayer Join Address Notice:</span>
                  </span>
                  <p className="text-zinc-300 font-mono">
                    Join in Minecraft using: <strong className="text-white bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">localhost:{port || 25565}</strong>
                  </p>
                  <p className="text-zinc-400 text-[10px] leading-relaxed">
                    {port !== 25565
                      ? 'Note: Because this server is set to port ' + (port || 25565) + ', you must include the port number in Minecraft Multiplayer (e.g. localhost:' + (port || 25565) + ').'
                      : 'Standard Minecraft port 25565 assigned. You can join with localhost or your IP.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Loader & Minecraft Version */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-zinc-300 font-medium">Choose Server Core / Loader</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {loadersList.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setLoader(l.id)}
                      className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                        loader === l.id
                          ? 'bg-zinc-800 border-emerald-500/80 text-zinc-100 shadow-md'
                          : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-zinc-200">{l.name}</span>
                        {loader === l.id && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                      <p className="text-[11px] text-zinc-500 line-clamp-2 mt-1 leading-relaxed">
                        {l.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className={isVanilla ? "grid grid-cols-1 gap-3 pt-2" : "grid grid-cols-2 gap-3 pt-2"}>
                <div className="space-y-1">
                  <label className="text-xs text-zinc-300 font-medium">Minecraft Version</label>
                  <select
                    value={minecraftVersion}
                    onChange={(e) => setMinecraftVersion(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none"
                  >
                    {availableMcVersions.map((v) => (
                      <option key={v} value={v}>
                        Minecraft {v}
                      </option>
                    ))}
                  </select>
                </div>

                {!isVanilla && (
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-300 font-medium flex items-center justify-between">
                      <span>Loader Version</span>
                      {isLoadingVersions && <Loader2 className="w-3 h-3 text-emerald-400 animate-spin" />}
                    </label>
                    <select
                      value={loaderVersion}
                      onChange={(e) => setLoaderVersion(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none"
                    >
                      {availableLoaderVersions.map((lv) => (
                        <option key={lv} value={lv}>
                          {lv}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Java 25 / 21 Requirement Notice for Fabric / Paper */}
              {(loader === 'fabric' || loader === 'paper' || loader === 'neoforge') && (
                <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs gap-3">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-purple-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      <span>{loader === 'fabric' || minecraftVersion.startsWith('1.21') ? 'Eclipse Temurin JDK 25 Linked' : 'Java 21 LTS Requirement'}</span>
                    </span>
                    <p className="text-zinc-300 text-[11px] leading-relaxed">
                      {loader === 'fabric' || minecraftVersion.startsWith('1.21')
                        ? 'Fabric Loader 0.16.10+ / MC 1.21.4 requires Eclipse Temurin JDK 25 (Class file 69.0). MMSM automatically installs and links JDK 25.'
                        : `${loader.toUpperCase()} on Minecraft ${minecraftVersion} requires Java 21 LTS. MMSM auto-configures the managed JDK.`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        fetch('/api/system/install-java25', { method: 'POST' });
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer shadow-md shadow-purple-950/40"
                    >
                      <Download className="w-3 h-3" />
                      <span>Install JDK 25</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        fetch('/api/system/install-java21', { method: 'POST' });
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3 h-3 text-emerald-400" />
                      <span>Install JDK 21</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Memory (in GB) & Content Selector (Modpack / Mods / Plugins) */}
          {step === 3 && (
            <div className="space-y-5">
              {/* RAM Section in GB */}
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-zinc-100 uppercase tracking-wide">
                    JVM Memory Allocation (-Xms & -Xmx)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Min RAM */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <label className="text-zinc-300 font-medium">Min RAM (-Xms)</label>
                      <span className="font-mono font-bold text-emerald-400">
                        {minRamGb} GB ({minRamGb * 1024} MB)
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="16"
                      step="1"
                      value={minRamGb}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setMinRamGb(val);
                        if (val > maxRamGb) setMaxRamGb(val);
                      }}
                      className="w-full accent-emerald-500"
                    />
                  </div>

                  {/* Max RAM */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <label className="text-zinc-300 font-medium">Max RAM (-Xmx)</label>
                      <span className="font-mono font-bold text-emerald-400">
                        {maxRamGb} GB ({maxRamGb * 1024} MB)
                      </span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="32"
                      step="1"
                      value={maxRamGb}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setMaxRamGb(val);
                        if (val < minRamGb) setMinRamGb(val);
                      }}
                      className="w-full accent-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Modpack / Mods / Plugins Selector */}
              {isVanilla ? (
                <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 space-y-2 text-center">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-zinc-200">Vanilla Server - Mod Installation Disabled</p>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                    Vanilla Minecraft only runs the official Mojang server JAR without mod or plugin support.
                    To install mods or plugins from Modrinth, please return to Step 2 and choose <strong className="text-emerald-400">Fabric</strong>, <strong className="text-emerald-400">Paper</strong>, or <strong className="text-emerald-400">NeoForge</strong>.
                  </p>
                </div>
              ) : (
                <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-100 uppercase tracking-wide flex items-center gap-2">
                      <Puzzle className="w-4 h-4 text-emerald-400" />
                      <span>Server Content (Modrinth)</span>
                    </span>

                    {(selectedModpack || selectedMods.length > 0) && (
                      <span className="text-[11px] font-mono text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40">
                        {selectedModpack ? '1 Modpack selected' : `${selectedMods.length} items selected`}
                      </span>
                    )}
                  </div>

                  {/* Content Type Selector Buttons */}
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setContentType('none');
                        setSelectedModpack(null);
                        setSelectedMods([]);
                      }}
                      className={`py-2 px-3 rounded-lg border font-semibold transition-colors cursor-pointer text-center ${
                        contentType === 'none'
                          ? 'bg-zinc-800 border-emerald-500 text-emerald-400'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Clean / Blank
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setContentType('modpack');
                        setSelectedMods([]);
                      }}
                      className={`py-2 px-3 rounded-lg border font-semibold transition-colors cursor-pointer text-center ${
                        contentType === 'modpack'
                          ? 'bg-zinc-800 border-emerald-500 text-emerald-400'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Add Modpack
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setContentType('mods');
                        setSelectedModpack(null);
                      }}
                      className={`py-2 px-3 rounded-lg border font-semibold transition-colors cursor-pointer text-center ${
                        contentType === 'mods'
                          ? 'bg-zinc-800 border-emerald-500 text-emerald-400'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Add Mods
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setContentType('plugins');
                        setSelectedModpack(null);
                      }}
                      className={`py-2 px-3 rounded-lg border font-semibold transition-colors cursor-pointer text-center ${
                        contentType === 'plugins'
                          ? 'bg-zinc-800 border-emerald-500 text-emerald-400'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      } ${!isPluginCompatible ? 'opacity-50' : ''}`}
                      title={!isPluginCompatible ? 'Plugins are only compatible with Paper/Purpur' : ''}
                    >
                      Add Plugins
                    </button>
                  </div>

                  {/* Modrinth Search Bar */}
                  {contentType !== 'none' && (
                    <div className="space-y-3 pt-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-3" />
                        <input
                          type="text"
                          placeholder={`Search Modrinth for ${contentType}...`}
                          value={contentSearchQuery}
                          onChange={(e) => setContentSearchQuery(e.target.value)}
                          className="w-full bg-[#0a0d12] border border-zinc-800 rounded-lg pl-8 pr-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500/60"
                        />
                      </div>

                      {/* Search Results Grid */}
                      <div className="max-h-52 overflow-y-auto space-y-1.5 p-1">
                        {isSearching ? (
                          <p className="text-xs text-zinc-500 text-center py-4">Searching Modrinth API...</p>
                        ) : searchResults.length === 0 ? (
                          <p className="text-xs text-zinc-500 text-center py-4">No results found for {contentType}</p>
                        ) : (
                          searchResults.map((item) => {
                            const isModSelected = selectedMods.some((m) => m.project_id === item.project_id);
                            const isPackSelected = selectedModpack?.project_id === item.project_id;

                            return (
                              <div
                                key={item.project_id}
                                onClick={() => {
                                  if (contentType === 'modpack') {
                                    setSelectedModpack(item);
                                  } else {
                                    toggleSelectMod(item);
                                  }
                                }}
                                className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                                  isPackSelected || isModSelected
                                    ? 'bg-emerald-950/40 border-emerald-500 text-zinc-100'
                                    : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  {item.icon_url ? (
                                    <img
                                      src={item.icon_url}
                                      alt=""
                                      className="w-7 h-7 rounded-lg bg-zinc-800 object-cover shrink-0"
                                    />
                                  ) : (
                                    <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                                      <Package className="w-3.5 h-3.5 text-zinc-400" />
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="font-semibold text-xs truncate">{item.title}</p>
                                    <p className="text-[10px] text-zinc-500 truncate">{item.description}</p>
                                  </div>
                                </div>

                                <div className="shrink-0">
                                  {contentType === 'modpack' ? (
                                    <div
                                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                        isPackSelected ? 'border-emerald-500 bg-emerald-500 text-black' : 'border-zinc-600'
                                      }`}
                                    >
                                      {isPackSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                    </div>
                                  ) : (
                                    <input
                                      type="checkbox"
                                      checked={isModSelected}
                                      onChange={() => {}}
                                      className="accent-emerald-500 w-4 h-4 cursor-pointer"
                                    />
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-4 border-t border-zinc-800 bg-[#0d1017] flex items-center justify-between">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-950/40"
            >
              <span>Next Step</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-950/50"
            >
              <Check className="w-4 h-4" />
              <span>Create Server</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
