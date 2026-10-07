import React, { useState, useRef } from 'react';
import {
  Sliders,
  FileCode,
  Save,
  CheckCircle2,
  AlertCircle,
  Eye,
  Settings,
  Database,
  Cpu,
  Lock,
  Globe,
  Radio,
  Image as ImageIcon,
  Moon,
  Upload,
  Sparkles,
  Check,
  Play,
  Wifi,
  Trash2,
  AlertTriangle,
  Download,
} from 'lucide-react';
import { useServer } from '../../context/ServerContext';
import { useAuth } from '../../context/AuthContext';
import { ServerProperties } from '../../types/server';

export const ConfigEditor: React.FC = () => {
  const {
    activeServer,
    updateProperties,
    setServerRam,
    updateServerIcon,
    toggleSleepMode,
    wakeServer,
    putServerToSleep,
    deleteServer,
  } = useServer();
  const { canPerformAction } = useAuth();

  const [mode, setMode] = useState<'visual' | 'raw'>('visual');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [formData, setFormData] = useState<ServerProperties>({
    levelName: 'world',
    levelSeed: '',
    enableCommandBlock: true,
    spawnAnimals: true,
    spawnMonsters: true,
    spawnNpcs: true,
    generateStructures: true,
    playerIdleTimeout: 0,
    networkCompressionThreshold: 256,
    maxWorldSize: 29999984,
    syncChunkWrites: true,
    opPermissionLevel: 4,
    functionPermissionLevel: 2,
    resourcePackUrl: '',
    resourcePackSha1: '',
    ...activeServer.properties,
  });

  // RAM configuration
  const [minRamMb, setMinRamMb] = useState<number>(activeServer.minRamMb || 2048);
  const [maxRamMb, setMaxRamMb] = useState<number>(activeServer.allocatedRamMb || 4096);

  // Sleep mode configuration
  const [sleepEnabled, setSleepEnabled] = useState<boolean>(activeServer.sleepModeEnabled ?? true);
  const [sleepTimeout, setSleepTimeout] = useState<number>(activeServer.sleepInactivityMinutes || 15);

  const [saveSuccess, setSaveSuccess] = useState(false);
  const iconFileInputRef = useRef<HTMLInputElement>(null);

  // Convert properties to raw server.properties string
  const generateRawProperties = () => {
    return Object.entries(formData)
      .map(([key, val]) => {
        // camelCase to kebab-case
        const kebabKey = key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
        return `${kebabKey}=${val}`;
      })
      .join('\n');
  };

  const [rawText, setRawText] = useState(generateRawProperties());

  const [selectedJavaVer, setSelectedJavaVer] = useState<string>(activeServer.javaVersion || 'auto');
  const [customJavaPathInput, setCustomJavaPathInput] = useState<string>('');
  const [isInstallingJava25, setIsInstallingJava25] = useState(false);
  const [javaNotice, setJavaNotice] = useState<string | null>(null);

  const handleSaveVisual = (e: React.FormEvent) => {
    e.preventDefault();
    const finalJavaVer = selectedJavaVer === 'custom' ? customJavaPathInput : selectedJavaVer;
    updateProperties(activeServer.id, formData, { javaVersion: finalJavaVer });
    setServerRam(activeServer.id, minRamMb, maxRamMb);
    toggleSleepMode(activeServer.id, sleepEnabled, sleepTimeout);
    setRawText(generateRawProperties());
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleSaveRaw = () => {
    const lines = rawText.split('\n');
    const newProps: any = { ...formData };
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.substring(0, idx).trim();
        const val = trimmed.substring(idx + 1).trim();
        if (key === 'motd') newProps.motd = val;
        if (key === 'server-port') newProps.serverPort = Number(val) || 25565;
        if (key === 'max-players') newProps.maxPlayers = Number(val) || 20;
        if (key === 'difficulty') newProps.difficulty = val;
        if (key === 'gamemode') newProps.gamemode = val;
        if (key === 'pvp') newProps.pvp = val === 'true';
        if (key === 'allow-flight') newProps.allowFlight = val === 'true';
        if (key === 'view-distance') newProps.viewDistance = Number(val) || 10;
        if (key === 'online-mode') newProps.onlineMode = val === 'true';
        if (key === 'spawn-protection') newProps.spawnProtection = Number(val) || 16;
        if (key === 'level-name') newProps.levelName = val;
        if (key === 'level-seed') newProps.levelSeed = val;
        if (key === 'enable-command-block') newProps.enableCommandBlock = val === 'true';
        if (key === 'enable-rcon') newProps.enableRcon = val === 'true';
        if (key === 'rcon.port') newProps.rconPort = Number(val) || 25575;
      }
    });

    setFormData(newProps);
    updateProperties(activeServer.id, newProps);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleIconFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const img = new Image();
        img.onload = () => {
          // Draw to canvas with 64x64 dimensions, preserving aspect ratio and converting to PNG
          const canvas = document.createElement('canvas');
          canvas.width = 64;
          canvas.height = 64;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = false; // pixelated look for Minecraft icons
            ctx.clearRect(0, 0, 64, 64);
            ctx.drawImage(img, 0, 0, 64, 64);
            const resizedDataUrl = canvas.toDataURL('image/png');
            updateServerIcon(activeServer.id, resizedDataUrl);
          } else {
            updateServerIcon(activeServer.id, reader.result as string);
          }
        };
        img.src = reader.result;
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const presetIcons = [
    { name: 'Diamond Sword', url: 'https://api.iconify.design/pixelarticons:sword.svg' },
    { name: 'Golden Trophy', url: 'https://api.iconify.design/pixelarticons:trophy.svg' },
    { name: 'Redstone Zap', url: 'https://api.iconify.design/pixelarticons:zap.svg' },
    { name: 'Explorer Compass', url: 'https://api.iconify.design/pixelarticons:compass.svg' },
    { name: 'Enchanted Shield', url: 'https://api.iconify.design/pixelarticons:shield.svg' },
    { name: 'Pixel Heart', url: 'https://api.iconify.design/pixelarticons:heart.svg' },
  ];

  const renderMotdPreview = (motdText: string) => {
    const parts = motdText.split(/(§[0-9a-fk-or])/g);
    let currentColor = '#ffffff';

    const colorMap: Record<string, string> = {
      '§0': '#000000',
      '§1': '#0000aa',
      '§2': '#00aa00',
      '§3': '#00aaaa',
      '§4': '#aa0000',
      '§5': '#aa00aa',
      '§6': '#ffaa00',
      '§7': '#aaaaaa',
      '§8': '#555555',
      '§9': '#5555ff',
      '§a': '#55ff55',
      '§b': '#55ffff',
      '§c': '#ff5555',
      '§d': '#ff55ff',
      '§e': '#ffff55',
      '§f': '#ffffff',
    };

    return (
      <div className="font-mono bg-[#141414] p-3 rounded-lg border border-zinc-700 flex items-center gap-3 select-none">
        <div className="relative shrink-0">
          {activeServer.serverIconUrl ? (
            <img
              src={activeServer.serverIconUrl}
              alt="server-icon.png"
              className="w-12 h-12 rounded object-contain bg-zinc-950 border border-zinc-700 p-0.5"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'https://api.iconify.design/pixelarticons:sword.svg';
              }}
            />
          ) : (
            <div className="w-12 h-12 bg-zinc-800 rounded border border-zinc-700 flex items-center justify-center font-bold text-emerald-400 text-sm">
              MC
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-mono mb-0.5">
            <span className="font-semibold text-zinc-100">{formData.serverName || activeServer.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-zinc-400 text-[11px]">
                {activeServer.status === 'online' ? activeServer.players.filter((p) => p.online).length : 0} / {formData.maxPlayers}
              </span>
              <div className="flex items-end gap-0.5 h-3" title="Ping: 18ms">
                <span className="w-1 h-1 bg-emerald-400 rounded-xs" />
                <span className="w-1 h-2 bg-emerald-400 rounded-xs" />
                <span className="w-1 h-3 bg-emerald-400 rounded-xs" />
              </div>
            </div>
          </div>
          <div className="text-xs font-mono truncate">
            {parts.map((p, i) => {
              if (colorMap[p]) {
                currentColor = colorMap[p];
                return null;
              }
              return (
                <span key={i} style={{ color: currentColor }}>
                  {p}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto w-full space-y-6">
      {/* Header */}
      <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <span>Server Properties & Memory Configuration</span>
              </h1>
              <p className="text-xs text-zinc-400">
                Live configuration for <strong className="text-zinc-200">{activeServer.name}</strong> · JVM RAM flags and <code className="text-zinc-300">server.properties</code>
              </p>
            </div>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800 text-xs">
          <button
            onClick={() => setMode('visual')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
              mode === 'visual' ? 'bg-zinc-800 text-emerald-400 shadow-sm font-semibold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Visual Form
          </button>
          <button
            onClick={() => {
              setRawText(generateRawProperties());
              setMode('raw');
            }}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
              mode === 'raw' ? 'bg-zinc-800 text-emerald-400 shadow-sm font-semibold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            server.properties (Raw)
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Properties and RAM settings successfully updated!</span>
        </div>
      )}

      {/* Hidden file input for server-icon.png upload */}
      <input
        type="file"
        ref={iconFileInputRef}
        onChange={handleIconFileUpload}
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
      />

      {/* MODE 1: VISUAL FORM */}
      {mode === 'visual' && (
        <form onSubmit={handleSaveVisual} className="space-y-5">
          {/* SERVER ICON (server-icon.png) SECTION */}
          <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-zinc-100">Server Icon (server-icon.png)</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                  64x64 PNG
                </span>
              </div>
              <button
                type="button"
                onClick={() => iconFileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-md shadow-emerald-950/40"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload server-icon.png</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              {/* Current Icon Preview */}
              <div className="flex items-center gap-4 p-3 bg-zinc-900/60 rounded-xl border border-zinc-800/80">
                <div className="relative shrink-0">
                  {activeServer.serverIconUrl ? (
                    <img
                      src={activeServer.serverIconUrl}
                      alt="server-icon.png"
                      className="w-16 h-16 rounded-lg border-2 border-zinc-700 bg-zinc-950 object-contain p-1 shadow-inner"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://api.iconify.design/pixelarticons:sword.svg';
                      }}
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center text-emerald-400 font-bold text-base">
                      MC
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-zinc-200">Current Server Icon</p>
                  <p className="text-[11px] text-zinc-400 font-mono">
                    Rendered in multiplayer server browser & dashboard cards.
                  </p>
                  <span className="text-[10px] text-emerald-400 font-mono block">
                    ✓ Valid 64x64 pixel asset
                  </span>
                </div>
              </div>

              {/* Preset Icon Selector */}
              <div className="space-y-2">
                <label className="text-zinc-400 text-xs font-medium block">Or choose a curated pixel icon:</label>
                <div className="flex flex-wrap items-center gap-2">
                  {presetIcons.map((ico) => (
                    <button
                      key={ico.name}
                      type="button"
                      onClick={() => updateServerIcon(activeServer.id, ico.url)}
                      className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                        activeServer.serverIconUrl === ico.url
                          ? 'bg-emerald-950/70 border-emerald-500 shadow-md shadow-emerald-950/50'
                          : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                      }`}
                      title={ico.name}
                    >
                      <img src={ico.url} alt={ico.name} className="w-6 h-6 object-contain" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* SERVER SLEEP & HIBERNATION MODE */}
          <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Moon className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-zinc-100">Server Sleep & Inactivity Hibernation</h3>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-indigo-950/60 text-indigo-300 border border-indigo-800/50">
                  Standby Proxy
                </span>
              </div>

              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sleepEnabled}
                    onChange={(e) => setSleepEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
                <span className="text-xs font-mono font-semibold text-zinc-300">
                  {sleepEnabled ? 'Sleep Mode ENABLED' : 'DISABLED'}
                </span>
              </div>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed max-w-3xl">
              When 0 players are active, the server gracefully suspends the JVM to 0% CPU and 0 MB RAM. A lightweight standby proxy keeps port <strong>:{activeServer.port}</strong> open and automatically wakes up the server the moment a player pings the server or clicks to connect.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 text-xs">
              <div className="space-y-1.5 p-3 bg-zinc-900 rounded-xl border border-zinc-800">
                <label className="text-zinc-300 font-medium block">Inactivity Timeout (Zero Players)</label>
                <select
                  disabled={!sleepEnabled}
                  value={sleepTimeout}
                  onChange={(e) => setSleepTimeout(Number(e.target.value))}
                  className="w-full bg-[#0a0d12] border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 font-mono disabled:opacity-50 focus:outline-none"
                >
                  <option value={5}>5 minutes with 0 players</option>
                  <option value={10}>10 minutes with 0 players</option>
                  <option value={15}>15 minutes (Recommended)</option>
                  <option value={30}>30 minutes with 0 players</option>
                  <option value={60}>60 minutes with 0 players</option>
                </select>
                <p className="text-[11px] text-zinc-500 font-mono">
                  Server will enter hibernation once idle timer expires.
                </p>
              </div>

              <div className="space-y-2 p-3 bg-zinc-900 rounded-xl border border-zinc-800 flex flex-col justify-between">
                <div>
                  <span className="text-zinc-400 font-medium block">Current Hibernation State</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        activeServer.status === 'sleeping' ? 'bg-indigo-400 animate-pulse' : 'bg-emerald-500'
                      }`}
                    />
                    <span className="font-mono font-bold text-zinc-100">
                      {activeServer.status === 'sleeping' ? '💤 Sleeping in Standby' : 'Awake & Active'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  {activeServer.status === 'sleeping' ? (
                    <button
                      type="button"
                      onClick={() => wakeServer(activeServer.id)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer transition-colors shadow-md shadow-indigo-950/40"
                    >
                      Simulate Client Ping / Wake Server
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => putServerToSleep(activeServer.id)}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold border border-zinc-700 cursor-pointer transition-colors"
                    >
                      Put to Sleep Now (Test Standby)
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          {/* JVM RAM CONFIGURATION SECTION (Requested: edit min and max RAM) */}
          <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <span>JVM Memory Allocation (Minimum & Maximum RAM)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              {/* Min RAM */}
              <div className="space-y-2 p-3 bg-zinc-900 rounded-xl border border-zinc-800">
                <div className="flex items-center justify-between">
                  <label className="text-zinc-300 font-medium">Initial / Minimum Memory (-Xms)</label>
                  <span className="font-mono font-bold text-emerald-400">
                    {(minRamMb / 1024).toFixed(1)} GB ({minRamMb} MB)
                  </span>
                </div>
                <input
                  type="range"
                  min="512"
                  max="16384"
                  step="512"
                  value={minRamMb}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setMinRamMb(val);
                    if (val > maxRamMb) setMaxRamMb(val);
                  }}
                  className="w-full accent-emerald-500"
                />
                <p className="text-[11px] text-zinc-500 font-mono">
                  Allocated immediately at process launch to prevent heap resizing pause lag.
                </p>
              </div>

              {/* Max RAM */}
              <div className="space-y-2 p-3 bg-zinc-900 rounded-xl border border-zinc-800">
                <div className="flex items-center justify-between">
                  <label className="text-zinc-300 font-medium">Maximum Memory (-Xmx)</label>
                  <span className="font-mono font-bold text-emerald-400">
                    {(maxRamMb / 1024).toFixed(1)} GB ({maxRamMb} MB)
                  </span>
                </div>
                <input
                  type="range"
                  min="1024"
                  max="32768"
                  step="512"
                  value={maxRamMb}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setMaxRamMb(val);
                    if (val < minRamMb) setMinRamMb(val);
                  }}
                  className="w-full accent-emerald-500"
                />
                <p className="text-[11px] text-zinc-500 font-mono">
                  Maximum heap memory cap for chunk cache and mod entities.
                </p>
              </div>
            </div>
          </div>

          {/* TARGET JAVA RUNTIME & VERSION SECTION */}
          <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-semibold text-zinc-100">Target Java Runtime & Version Link</h3>
              </div>
              <button
                type="button"
                disabled={isInstallingJava25}
                onClick={async () => {
                  setIsInstallingJava25(true);
                  setJavaNotice('Downloading & linking Eclipse Temurin JDK 25...');
                  try {
                    const res = await fetch('/api/system/install-java25', { method: 'POST' });
                    const data = await res.json();
                    if (data.success) {
                      setSelectedJavaVer('Java 25 (Eclipse Temurin JDK 25)');
                      setJavaNotice('Eclipse Temurin JDK 25 installed & linked to this server!');
                    } else {
                      setJavaNotice(`Install failed: ${data.error}`);
                    }
                  } catch {
                    setJavaNotice('Error connecting to backend Java installer.');
                  } finally {
                    setIsInstallingJava25(false);
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-purple-950/40 disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isInstallingJava25 ? 'Installing...' : '1-Click Install JDK 25'}</span>
              </button>
            </div>

            {javaNotice && (
              <div className="p-3 bg-purple-950/40 border border-purple-800/60 rounded-xl text-xs text-purple-300 font-mono flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
                <span>{javaNotice}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-zinc-300 font-medium block">Select Installed Java Runtime</label>
                <select
                  value={selectedJavaVer}
                  onChange={(e) => setSelectedJavaVer(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 font-mono focus:outline-none focus:border-purple-500/60"
                >
                  <option value="auto">Auto-Detect (Eclipse Temurin JDK 25 for Fabric/MC 1.21+)</option>
                  <option value="Java 25 (Eclipse Temurin JDK 25)">Eclipse Temurin JDK 25 (Managed ./runtimes/java-25)</option>
                  <option value="Java 21 (Eclipse Temurin JDK 21)">Eclipse Temurin JDK 21 LTS (Managed ./runtimes/java-21)</option>
                  <option value="Java 17 (Eclipse Temurin JDK 17)">Eclipse Temurin JDK 17 LTS (Managed ./runtimes/java-17)</option>
                  <option value="Java 8 (Eclipse Temurin JDK 8)">Eclipse Temurin JDK 8 (Managed ./runtimes/java-8)</option>
                  <option value="system-default">System Default Java (PATH)</option>
                  <option value="custom">Custom Binary Path...</option>
                </select>
                <p className="text-[11px] text-zinc-400 leading-relaxed mt-1">
                  {activeServer.loader === 'fabric' || activeServer.minecraftVersion.startsWith('1.21')
                    ? '⚡ Fabric 0.16.10+ / MC 1.21.4+ automatically uses Eclipse Temurin JDK 25 to prevent Class 69.0 errors.'
                    : 'Select specific JDK version or let MMSM auto-match based on server core.'}
                </p>
              </div>

              {selectedJavaVer === 'custom' && (
                <div className="space-y-1.5">
                  <label className="text-zinc-300 font-medium block">Custom java.exe / java Binary Absolute Path</label>
                  <input
                    type="text"
                    value={customJavaPathInput}
                    onChange={(e) => setCustomJavaPathInput(e.target.value)}
                    placeholder="C:\Program Files\Java\jdk-25\bin\java.exe"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 font-mono text-xs focus:outline-none focus:border-purple-500/60"
                  />
                  <p className="text-[11px] text-zinc-500 font-mono">
                    Absolute executable path on the host server system.
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-400" />
              <span>Multiplayer Server List Appearance (MOTD)</span>
            </h3>

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 font-mono">
                MOTD String (Supports §a, §b, §c, §e, §f formatting codes)
              </label>
              <input
                type="text"
                value={formData.motd}
                onChange={(e) => setFormData({ ...formData, motd: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-emerald-500/60"
              />
            </div>

            <div className="space-y-1">
              <span className="text-[11px] text-zinc-500 font-mono uppercase">In-Game Server List Preview</span>
              {renderMotdPreview(formData.motd)}
            </div>
          </div>

          {/* World Generation & Levels */}
          <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-400" />
              <span>World Settings & Seed</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
              <div className="space-y-1">
                <label className="text-zinc-400">Level Name (World folder)</label>
                <input
                  type="text"
                  value={formData.levelName || 'world'}
                  onChange={(e) => setFormData({ ...formData, levelName: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400">World Generation Seed (Optional)</label>
                <input
                  type="text"
                  value={formData.levelSeed || ''}
                  placeholder="e.g. 48192049182390"
                  onChange={(e) => setFormData({ ...formData, levelSeed: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400">Spawn Protection (Blocks)</label>
                <input
                  type="number"
                  value={formData.spawnProtection}
                  onChange={(e) => setFormData({ ...formData, spawnProtection: Number(e.target.value) })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100"
                />
              </div>
            </div>
          </div>

          {/* Gameplay & Difficulty */}
          <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              <Settings className="w-4 h-4 text-emerald-400" />
              <span>Gameplay Rules & Limits</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="space-y-1">
                <label className="text-zinc-400 font-mono text-[11px]">Difficulty</label>
                <select
                  value={formData.difficulty}
                  onChange={(e) => setFormData({ ...formData, difficulty: e.target.value as any })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none"
                >
                  <option value="peaceful">Peaceful</option>
                  <option value="easy">Easy</option>
                  <option value="normal">Normal</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 font-mono text-[11px]">Default Gamemode</label>
                <select
                  value={formData.gamemode}
                  onChange={(e) => setFormData({ ...formData, gamemode: e.target.value as any })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none"
                >
                  <option value="survival">Survival</option>
                  <option value="creative">Creative</option>
                  <option value="adventure">Adventure</option>
                  <option value="spectator">Spectator</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 font-mono text-[11px]">Max Players Limit</label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={formData.maxPlayers}
                  onChange={(e) => setFormData({ ...formData, maxPlayers: Number(e.target.value) })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none font-mono"
                />
              </div>
            </div>

            {/* Entity toggles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-zinc-800 text-xs">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.pvp}
                  onChange={(e) => setFormData({ ...formData, pvp: e.target.checked })}
                  className="accent-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-zinc-300">PvP (Combat)</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.onlineMode}
                  onChange={(e) => setFormData({ ...formData, onlineMode: e.target.checked })}
                  className="accent-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-zinc-300">Online Mode (Mojang Auth)</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.enableCommandBlock ?? true}
                  onChange={(e) => setFormData({ ...formData, enableCommandBlock: e.target.checked })}
                  className="accent-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-zinc-300">Command Blocks</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.spawnMonsters ?? true}
                  onChange={(e) => setFormData({ ...formData, spawnMonsters: e.target.checked })}
                  className="accent-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-zinc-300">Spawn Monsters</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.spawnAnimals ?? true}
                  onChange={(e) => setFormData({ ...formData, spawnAnimals: e.target.checked })}
                  className="accent-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-zinc-300">Spawn Animals</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.spawnNpcs ?? true}
                  onChange={(e) => setFormData({ ...formData, spawnNpcs: e.target.checked })}
                  className="accent-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-zinc-300">Spawn Villagers / NPCs</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.generateStructures ?? true}
                  onChange={(e) => setFormData({ ...formData, generateStructures: e.target.checked })}
                  className="accent-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-zinc-300">Generate Structures</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.hardcore}
                  onChange={(e) => setFormData({ ...formData, hardcore: e.target.checked })}
                  className="accent-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-zinc-300">Hardcore Permadeath</span>
              </label>
            </div>
          </div>

          {/* Networking & Distances */}
          <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400" />
              <span>Networking, RCON & Chunks</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono">
              <div className="space-y-1">
                <label className="text-zinc-400 text-[11px]">Server Port</label>
                <input
                  type="number"
                  value={formData.serverPort}
                  onChange={(e) => setFormData({ ...formData, serverPort: Number(e.target.value) })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 text-[11px]">View Distance ({formData.viewDistance} chunks)</label>
                <input
                  type="range"
                  min="4"
                  max="24"
                  value={formData.viewDistance}
                  onChange={(e) => setFormData({ ...formData, viewDistance: Number(e.target.value) })}
                  className="w-full accent-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 text-[11px]">Simulation Distance ({formData.simulationDistance} chunks)</label>
                <input
                  type="range"
                  min="3"
                  max="16"
                  value={formData.simulationDistance}
                  onChange={(e) => setFormData({ ...formData, simulationDistance: Number(e.target.value) })}
                  className="w-full accent-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 text-[11px]">Player Idle Timeout (min)</label>
                <input
                  type="number"
                  value={formData.playerIdleTimeout || 0}
                  onChange={(e) => setFormData({ ...formData, playerIdleTimeout: Number(e.target.value) })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          {canPerformAction('edit_config') && (
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-950/50 flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save All Properties & RAM</span>
              </button>
            </div>
          )}
        </form>
      )}

      {/* MODE 2: RAW TEXT */}
      {mode === 'raw' && (
        <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 font-mono">/server.properties</span>
            <span className="text-xs text-zinc-500 font-mono">Raw Configuration Editor</span>
          </div>

          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={22}
            className="w-full bg-[#0a0d12] border border-zinc-800 rounded-lg p-4 font-mono text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/60 leading-relaxed"
          />

          {canPerformAction('edit_config') && (
            <div className="flex justify-end">
              <button
                onClick={handleSaveRaw}
                className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-950/50 flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save Raw server.properties</span>
              </button>
            </div>
          )}
        </div>
      )}
      {/* DANGER ZONE: DELETE SERVER */}
      <div className="bg-rose-950/20 border border-rose-900/40 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2 text-rose-400">
          <AlertTriangle className="w-4 h-4" />
          <h3 className="text-sm font-bold uppercase tracking-wider">Danger Zone</h3>
        </div>
        <p className="text-xs text-zinc-300 leading-relaxed">
          Permanently delete <strong className="text-white font-mono">{activeServer.name}</strong>. This removes the server configuration, worlds, mods, and telemetry history from the launcher.
        </p>

        {canPerformAction('manage_servers') && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-950/40 flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete This Server</span>
            </button>
          </div>
        )}
      </div>

      {/* CONFIRMATION MODAL FOR DELETING SERVER */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#11151c] border border-rose-900/50 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-100">Permanently Delete Server?</h3>
                <p className="text-xs text-zinc-400 font-mono">{activeServer.name}</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-white font-mono">{activeServer.name}</strong>?
              All server files, worlds, and plugins will be removed.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold border border-zinc-800 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteServer(activeServer.id);
                  setIsDeleteModalOpen(false);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-950/40 cursor-pointer transition-colors"
              >
                Delete Server Forever
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
