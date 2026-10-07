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
  AlertTriangle,
  Terminal,
  Download,
  Upload,
  Copy,
  Check,
  Folder,
  Globe,
  Wifi,
  RefreshCw,
  Sparkles,
  Layers,
  Radio,
  Lock,
  Loader2,
  ExternalLink,
  GitBranch,
  Play,
  Square,
  HelpCircle,
  Palette,
  HardDrive,
  Eraser,
  Sword,
  Pickaxe,
  Eye,
  Box,
} from 'lucide-react';
import { useServer } from '../../context/ServerContext';
import { useAuth } from '../../context/AuthContext';
import { MinecraftServer, AccentThemeColor, EmblemIconPreset } from '../../types/server';
import { MmsmLogo } from '../common/MmsmLogo';

interface WrapperSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'general' | 'appearance' | 'hardware' | 'networking' | 'updater' | 'launcher' | 'vault';
}

export const WrapperSettingsModal: React.FC<WrapperSettingsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'general',
}) => {
  const {
    servers,
    unarchiveServer,
    deleteServer,
    purgeSampleData,
    wrapperSettings,
    updateWrapperSettings,
    checkForGitHubUpdate,
    performGitHubUpdate,
    isUpdatingWrapper,
    updateProgressStep,
  } = useServer();
  const { canPerformAction } = useAuth();

  const [activeTab, setActiveTab] = useState<'general' | 'appearance' | 'hardware' | 'networking' | 'updater' | 'launcher' | 'vault'>(
    initialTab
  );
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [deleteConfirmServer, setDeleteConfirmServer] = useState<MinecraftServer | null>(null);
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
  const [copiedBatch, setCopiedBatch] = useState(false);
  const [copiedPs1, setCopiedPs1] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateCheckNotice, setUpdateCheckNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const archivedServers = servers.filter((s) => s.isArchived);
  const onlineCount = servers.filter((s) => s.status === 'online' && !s.isArchived).length;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleCheckUpdatesNow = async () => {
    setIsCheckingUpdate(true);
    try {
      const hasUpdate = await checkForGitHubUpdate();
      if (hasUpdate) {
        setUpdateCheckNotice('New update available: v2.6.0!');
      } else {
        setUpdateCheckNotice('You are running the latest version of MMSM (v2.6.0).');
      }
    } finally {
      setIsCheckingUpdate(false);
      setTimeout(() => setUpdateCheckNotice(null), 4000);
    }
  };

  // Windows 11 / 10 Batch script
  const batchScriptContent = `@echo off
title MMSM - Minecraft Server Manager Launcher
color 0A
cd /d "%~dp0"

echo ======================================================================
echo    MMSM - MrHaydenn's Minecraft Server Manager Wrapper
echo                  Windows 11 Startup Launcher
echo ======================================================================
echo.

if not exist "%~dp0package.json" (
    if exist "%~dp0MMSM-main\\package.json" (
        cd /d "%~dp0MMSM-main"
    ) else if exist "%~dp0..\\package.json" (
        cd /d "%~dp0..\\"
    ) else (
        color 0C
        echo [ERROR] package.json not found! Please extract all files.
        pause
        exit /b 1
    )
)

if not exist "node_modules" (
    echo [MMSM] Installing dependencies for first-time launch...
    call npm install --legacy-peer-deps
    if errorlevel 1 call npm install --force
)

start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"
call npm run dev
pause
`;

  // PowerShell Runner
  const ps1ScriptContent = `# MMSM - MrHaydenn's Minecraft Server Manager PowerShell Launcher
$ErrorActionPreference = "Continue"
Set-Location -Path $PSScriptRoot

if (-not (Test-Path "package.json")) {
    if (Test-Path "MMSM-main\\package.json") {
        Set-Location -Path "MMSM-main"
    } elseif (Test-Path "..\\package.json") {
        Set-Location -Path ".."
    }
}

if (-not (Test-Path "node_modules")) {
    Write-Host "[MMSM] Installing dependencies..." -ForegroundColor Cyan
    npm install --legacy-peer-deps
    if ($LASTEXITCODE -ne 0) { npm install --force }
}

Start-Process "http://localhost:3000"
npm run dev
Read-Host "MMSM stopped. Press Enter to close"
`;

  const handleDownloadLauncher = () => {
    const blob = new Blob([batchScriptContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'start-mmsm.bat';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPs1 = () => {
    const blob = new Blob([ps1ScriptContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'start-mmsm.ps1';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyBatch = () => {
    navigator.clipboard.writeText(batchScriptContent);
    setCopiedBatch(true);
    setTimeout(() => setCopiedBatch(false), 2500);
  };

  const handleCopyPs1 = () => {
    navigator.clipboard.writeText(ps1ScriptContent);
    setCopiedPs1(true);
    setTimeout(() => setCopiedPs1(false), 2500);
  };

  const accentColors: { id: AccentThemeColor; name: string; bg: string; border: string }[] = [
    { id: 'emerald', name: 'Emerald Green (Default)', bg: 'bg-emerald-500', border: 'border-emerald-500' },
    { id: 'blue', name: 'Cyber Sapphire', bg: 'bg-blue-500', border: 'border-blue-500' },
    { id: 'purple', name: 'Amethyst Purple', bg: 'bg-purple-500', border: 'border-purple-500' },
    { id: 'red', name: 'Crimson Ruby', bg: 'bg-rose-500', border: 'border-rose-500' },
    { id: 'amber', name: 'Golden Amber', bg: 'bg-amber-500', border: 'border-amber-500' },
    { id: 'cyan', name: 'Neon Cyan', bg: 'bg-cyan-500', border: 'border-cyan-500' },
    { id: 'rose', name: 'Rose Quartz', bg: 'bg-pink-500', border: 'border-pink-500' },
    { id: 'zinc', name: 'Obsidian Slate', bg: 'bg-zinc-400', border: 'border-zinc-400' },
  ];

  const emblemPresets: { id: EmblemIconPreset; name: string; icon: React.ReactNode }[] = [
    { id: 'sword', name: 'Netherite Sword', icon: <Sword className="w-4 h-4 text-emerald-400" /> },
    { id: 'pickaxe', name: 'Diamond Pickaxe', icon: <Pickaxe className="w-4 h-4 text-cyan-400" /> },
    { id: 'ender_eye', name: 'Ender Eye', icon: <Eye className="w-4 h-4 text-purple-400" /> },
    { id: 'server_rack', name: 'Server Rack', icon: <Server className="w-4 h-4 text-blue-400" /> },
    { id: 'golden_apple', name: 'Golden Apple', icon: <Sparkles className="w-4 h-4 text-amber-400" /> },
    { id: 'shield', name: 'Battle Shield', icon: <Shield className="w-4 h-4 text-rose-400" /> },
    { id: 'cube', name: 'Minecraft Block', icon: <Box className="w-4 h-4 text-emerald-400" /> },
  ];

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-[#11151c] border border-zinc-800 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-[#151922]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <span>MMSM Wrapper Settings</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-semibold">
                  Host Level
                </span>
              </h2>
              <p className="text-xs text-zinc-400">Branding, machine hardware specs, networking, launchers & data management</p>
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
        <div className="px-5 pt-3 border-b border-zinc-800 flex items-center gap-2 bg-[#0d1017] overflow-x-auto">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-3.5 py-2 border-b-2 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'general'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>General & Storage</span>
          </button>

          <button
            onClick={() => setActiveTab('appearance')}
            className={`px-3.5 py-2 border-b-2 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'appearance'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Appearance & Emblem</span>
          </button>

          <button
            onClick={() => setActiveTab('hardware')}
            className={`px-3.5 py-2 border-b-2 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'hardware'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Hardware & Clean Slate</span>
          </button>

          <button
            onClick={() => setActiveTab('networking')}
            className={`px-3.5 py-2 border-b-2 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'networking'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Networking & WebGUI</span>
          </button>

          <button
            onClick={() => setActiveTab('updater')}
            className={`px-3.5 py-2 border-b-2 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'updater'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Auto-Updater</span>
          </button>

          <button
            onClick={() => setActiveTab('vault')}
            className={`px-3.5 py-2 border-b-2 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'vault'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Vault ({archivedServers.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {saveSuccess && (
            <div className="p-3.5 bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 rounded-xl flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Wrapper preferences saved successfully!</span>
            </div>
          )}

          {/* TAB 1: GENERAL */}
          {activeTab === 'general' && (
            <form onSubmit={handleSave} className="space-y-6">
              <div className="p-4 bg-zinc-900/80 rounded-xl border border-zinc-800 space-y-4">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-zinc-200 uppercase tracking-wide">
                    Default Storage Locations
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="space-y-1">
                    <label className="text-zinc-300 font-medium flex items-center justify-between">
                      <span>Default Servers Directory</span>
                      <span className="text-[10px] text-zinc-500 font-mono">Folder where server files reside</span>
                    </label>
                    <input
                      type="text"
                      value={wrapperSettings.serversDirectory || '/Servers'}
                      onChange={(e) =>
                        updateWrapperSettings({ serversDirectory: e.target.value })
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-zinc-300 font-medium flex items-center justify-between">
                      <span>Default Backups Directory</span>
                      <span className="text-[10px] text-zinc-500 font-mono">Secondary drives supported (e.g. D:/MinecraftBackups)</span>
                    </label>
                    <input
                      type="text"
                      value={wrapperSettings.backupsDirectory || '/Backups'}
                      onChange={(e) =>
                        updateWrapperSettings({ backupsDirectory: e.target.value })
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Memory Defaults in GB */}
              <div className="p-4 bg-zinc-900/80 rounded-xl border border-zinc-800 space-y-4">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-zinc-200 uppercase tracking-wide">
                    Default Memory Allocations (GB)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  <div className="space-y-1.5">
                    <label className="text-zinc-400 block font-sans">Default Min RAM (-Xms)</label>
                    <select
                      value={wrapperSettings.defaultMinRamGb}
                      onChange={(e) =>
                        updateWrapperSettings({ defaultMinRamGb: Number(e.target.value) })
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none"
                    >
                      {[1, 2, 4, 6, 8, 12, 16].map((gb) => (
                        <option key={gb} value={gb}>
                          {gb} GB ({gb * 1024} MB)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-zinc-400 block font-sans">Default Max RAM (-Xmx)</label>
                    <select
                      value={wrapperSettings.defaultMaxRamGb}
                      onChange={(e) =>
                        updateWrapperSettings({ defaultMaxRamGb: Number(e.target.value) })
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none"
                    >
                      {[2, 4, 6, 8, 12, 16, 24, 32, 64].map((gb) => (
                        <option key={gb} value={gb}>
                          {gb} GB ({gb * 1024} MB)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/40 cursor-pointer transition-colors"
                >
                  Save General Preferences
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: APPEARANCE & EMBLEM */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              {/* Live Preview Bar */}
              <div className="p-4 bg-zinc-900/80 rounded-xl border border-zinc-800 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <MmsmLogo size={44} />
                  <div>
                    <span className="text-xs text-zinc-400 block font-mono">Emblem & Accent Live Preview</span>
                    <span className="text-base font-bold font-mono text-zinc-100">
                      MMSM <span className="text-xs uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-normal">Theme Active</span>
                    </span>
                  </div>
                </div>
                <span className="text-xs text-zinc-400 font-mono hidden sm:block">
                  Accent: <strong className="capitalize text-zinc-200">{wrapperSettings.accentColor || 'emerald'}</strong>
                </span>
              </div>

              {/* Accent Color Picker */}
              <div className="p-4 bg-zinc-900/80 rounded-xl border border-zinc-800 space-y-3">
                <label className="text-xs font-bold text-zinc-200 uppercase tracking-wide flex items-center gap-2">
                  <Palette className="w-4 h-4 text-emerald-400" />
                  <span>Wrapper Accent Color Theme</span>
                </label>
                <p className="text-xs text-zinc-400">
                  Select the primary accent color applied to header emblems, badges, buttons, and dashboard highlights.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  {accentColors.map((c) => {
                    const isSelected = (wrapperSettings.accentColor || 'emerald') === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => updateWrapperSettings({ accentColor: c.id })}
                        className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-zinc-800 border-zinc-300 shadow-lg'
                            : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <span className={`w-4 h-4 rounded-full ${c.bg} shrink-0 shadow`} />
                        <span className="text-xs font-semibold text-zinc-200 truncate">{c.name.split(' ')[0]}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-zinc-100 ml-auto shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Top-Left Corner Emblem Selector */}
              <div className="p-4 bg-zinc-900/80 rounded-xl border border-zinc-800 space-y-3">
                <label className="text-xs font-bold text-zinc-200 uppercase tracking-wide flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>Top-Left Corner Emblem Icon</span>
                </label>
                <p className="text-xs text-zinc-400">
                  Choose a preset Minecraft or server emblem, or paste a custom image URL below.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                  {emblemPresets.map((emb) => {
                    const isSelected = (wrapperSettings.customEmblemIcon || 'sword') === emb.id;
                    return (
                      <button
                        key={emb.id}
                        type="button"
                        onClick={() => updateWrapperSettings({ customEmblemIcon: emb.id, customWrapperLogoUrl: '' })}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                          isSelected && !wrapperSettings.customWrapperLogoUrl
                            ? 'bg-zinc-800 border-emerald-500 shadow-md text-zinc-100'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        {emb.icon}
                        <span className="text-xs font-semibold truncate">{emb.name}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Photo Upload */}
                <div className="pt-3 border-t border-zinc-800 space-y-2 text-xs">
                  <label className="text-zinc-300 font-semibold flex items-center justify-between">
                    <span>Custom Logo / Image Upload</span>
                    <span className="text-[10px] text-zinc-500 font-mono">JPG, PNG, SVG, WEBP</span>
                  </label>

                  {wrapperSettings.customWrapperLogoUrl ? (
                    <div className="flex items-center gap-3 p-3 bg-zinc-950 border border-zinc-800 rounded-xl">
                      <img
                        src={wrapperSettings.customWrapperLogoUrl}
                        alt="Custom Logo Preview"
                        className="w-12 h-12 object-contain rounded-lg bg-zinc-900 border border-zinc-800 p-1"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-semibold text-zinc-200 block truncate">Custom Photo Active</span>
                        <span className="text-[10px] text-emerald-400 font-mono">Applied to top-left emblem</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateWrapperSettings({ customWrapperLogoUrl: '' })}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/50 text-xs font-medium cursor-pointer transition-colors"
                      >
                        Remove Photo
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center p-4 bg-zinc-950 border-2 border-dashed border-zinc-800 hover:border-emerald-500/50 rounded-xl cursor-pointer transition-all group">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              if (typeof event.target?.result === 'string') {
                                updateWrapperSettings({ customWrapperLogoUrl: event.target.result });
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <Upload className="w-5 h-5 text-zinc-500 group-hover:text-emerald-400 mb-1 transition-colors" />
                      <span className="text-xs font-semibold text-zinc-300 group-hover:text-emerald-300">Click to Upload Photo</span>
                      <span className="text-[10px] text-zinc-500 mt-0.5">or drag and drop your image file here</span>
                    </label>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: HARDWARE & CLEAN SLATE */}
          {activeTab === 'hardware' && (
            <div className="space-y-6">
              {/* Host Machine Hardware Specs */}
              <div className="p-4 bg-zinc-900/80 rounded-xl border border-zinc-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-zinc-200 uppercase tracking-wide">
                      Host Machine Hardware Specifications
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const detectedRam = (typeof navigator !== 'undefined' && (navigator as any).deviceMemory) ? (navigator as any).deviceMemory : 16;
                      const detectedCpu = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) ? navigator.hardwareConcurrency : 8;
                      updateWrapperSettings({
                        hostHardware: {
                          totalRamGb: detectedRam,
                          cpuCores: detectedCpu,
                          totalDiskGb: wrapperSettings.hostHardware?.totalDiskGb || 500,
                        },
                      });
                    }}
                    className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] rounded-lg border border-zinc-700 cursor-pointer"
                  >
                    Auto-Detect System
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
                  <div className="space-y-1.5">
                    <label className="text-zinc-400 font-sans">Total Physical RAM (GB)</label>
                    <input
                      type="number"
                      min="4"
                      max="512"
                      value={wrapperSettings.hostHardware?.totalRamGb || 16}
                      onChange={(e) =>
                        updateWrapperSettings({
                          hostHardware: {
                            ...(wrapperSettings.hostHardware || { cpuCores: 8, totalDiskGb: 500 }),
                            totalRamGb: Number(e.target.value) || 16,
                          },
                        })
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-zinc-400 font-sans">CPU Thread Cores</label>
                    <input
                      type="number"
                      min="2"
                      max="128"
                      value={wrapperSettings.hostHardware?.cpuCores || 8}
                      onChange={(e) =>
                        updateWrapperSettings({
                          hostHardware: {
                            ...(wrapperSettings.hostHardware || { totalRamGb: 16, totalDiskGb: 500 }),
                            cpuCores: Number(e.target.value) || 8,
                          },
                        })
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-zinc-400 font-sans">Total Storage Drive (GB)</label>
                    <input
                      type="number"
                      min="50"
                      max="8000"
                      value={wrapperSettings.hostHardware?.totalDiskGb || 500}
                      onChange={(e) =>
                        updateWrapperSettings({
                          hostHardware: {
                            ...(wrapperSettings.hostHardware || { totalRamGb: 16, cpuCores: 8 }),
                            totalDiskGb: Number(e.target.value) || 500,
                          },
                        })
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Java Environment Check & Runtime Management */}
              <div className="p-4 bg-zinc-900/80 rounded-xl border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-zinc-200 uppercase tracking-wide">
                      Java Runtimes & System Environment Check
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-semibold">
                    MC 1.20.5+ / Fabric Ready
                  </span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Minecraft 1.20.5+ and Fabric 1.21+ require Java 21 LTS. If your device lacks Java 21 or has an old Java version, MMSM can automatically download and configure an isolated Adoptium Temurin OpenJDK 21 LTS runtime for your servers.
                </p>

                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="font-semibold text-zinc-200">Managed Java 21 LTS (MMSM Runtime)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        fetch('/api/system/install-java21', { method: 'POST' });
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Auto-Install Java 21 LTS</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-400 font-mono">
                    Target Path: <span className="text-zinc-200">./runtimes/java-21/bin/java</span>
                  </p>
                </div>
              </div>

              {/* Clean Slate & Sample Data Purge */}
              <div className="p-4 bg-rose-950/20 border border-rose-900/40 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-rose-400">
                  <Eraser className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wide">
                    Clean Slate / Reset Test Data
                  </span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Ready to publish or start fresh? Purge all pre-seeded demo servers, mock logs, and sample download records with one click so your launcher starts with a 100% blank slate.
                </p>

                <div className="pt-1 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsPurgeModalOpen(true)}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-950/50 cursor-pointer transition-colors"
                  >
                    Wipe Sample Data & Start Blank
                  </button>
                  <span className="text-[11px] text-zinc-500 font-mono">
                    Currently: {servers.length} configured server(s)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: NETWORKING */}
          {activeTab === 'networking' && (
            <form onSubmit={handleSave} className="space-y-6">
              <div className="p-4 bg-zinc-900/80 rounded-xl border border-zinc-800 space-y-4">
                <div className="flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-zinc-200 uppercase tracking-wide">
                    MMSM Wrapper WebGUI Network Settings
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1.5">
                    <label className="text-zinc-300 font-medium flex items-center justify-between">
                      <span>WebGUI Port</span>
                      <span className="text-[10px] text-zinc-500 font-mono">Default: 3000</span>
                    </label>
                    <input
                      type="number"
                      value={wrapperSettings.wrapperWebPort || 3000}
                      onChange={(e) =>
                        updateWrapperSettings({ wrapperWebPort: Number(e.target.value) })
                      }
                      placeholder="3000"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 font-mono focus:outline-none focus:border-emerald-500"
                    />
                    <p className="text-[11px] text-zinc-500 font-mono">
                      Access URL: <strong className="text-emerald-400">http://localhost:{wrapperSettings.wrapperWebPort || 3000}</strong>
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-zinc-300 font-medium flex items-center justify-between">
                      <span>Host Interface Binding</span>
                      <span className="text-[10px] text-zinc-500 font-mono">0.0.0.0 for LAN</span>
                    </label>
                    <select
                      value={wrapperSettings.wrapperBindHost || '0.0.0.0'}
                      onChange={(e) =>
                        updateWrapperSettings({
                          wrapperBindHost: e.target.value as '0.0.0.0' | '127.0.0.1',
                        })
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 font-mono focus:outline-none focus:border-emerald-500"
                    >
                      <option value="0.0.0.0">0.0.0.0 (All interfaces / LAN & WAN)</option>
                      <option value="127.0.0.1">127.0.0.1 (Localhost only)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Public Host / Domain */}
              <div className="p-4 bg-zinc-900/80 rounded-xl border border-zinc-800 space-y-4">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-zinc-200 uppercase tracking-wide">
                    Default Public Connect IP / Domain
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <label className="text-zinc-300 font-medium">Default Server Join Address</label>
                  <input
                    type="text"
                    value={wrapperSettings.publicIp || ''}
                    onChange={(e) => updateWrapperSettings({ publicIp: e.target.value })}
                    placeholder="e.g. play.mydomain.com or 192.168.1.50"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[11px] text-zinc-500 font-mono">
                    Individual servers can also override this with their own custom domain and display port on each card.
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/40 cursor-pointer transition-colors"
                >
                  Save Networking Settings
                </button>
              </div>
            </form>
          )}

          {/* TAB 5: UPDATER */}
          {activeTab === 'updater' && (
            <div className="space-y-6">
              <div className="p-5 bg-zinc-900/90 rounded-2xl border border-zinc-800 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <GitBranch className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-zinc-100">MMSM Launcher Core Release</h3>
                      <p className="text-xs text-zinc-400 font-mono">
                        Current: <strong className="text-zinc-200">{wrapperSettings.githubUpdate.currentVersion}</strong> · Latest: <strong className="text-emerald-400">{wrapperSettings.githubUpdate.latestVersion}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isCheckingUpdate || isUpdatingWrapper}
                      onClick={handleCheckUpdatesNow}
                      className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 border border-zinc-700 cursor-pointer disabled:opacity-50"
                    >
                      {isCheckingUpdate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      <span>Check GitHub</span>
                    </button>

                    {wrapperSettings.githubUpdate.hasUpdate && (
                      <button
                        type="button"
                        disabled={isUpdatingWrapper}
                        onClick={() => performGitHubUpdate()}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/50 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isUpdatingWrapper ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        <span>Update Now</span>
                      </button>
                    )}
                  </div>
                </div>

                {updateCheckNotice && (
                  <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-xs text-emerald-300 font-mono">
                    {updateCheckNotice}
                  </div>
                )}

                {/* GitHub Release Info Box */}
                <div className="p-4 bg-zinc-950/60 border border-zinc-800/80 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold">
                    <Sparkles className="w-4 h-4" />
                    <span>How GitHub Auto-Updates Work</span>
                  </div>
                  <p className="text-zinc-300 leading-relaxed">
                    MMSM automatically queries the GitHub Releases API (<code className="text-emerald-400 font-mono text-[11px]">/repos/MrHaydenn/mmsm/releases/latest</code>).
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-zinc-400 text-[11px] pl-1">
                    <li><strong className="text-zinc-200">Releases Required:</strong> To publish an update for users, create an official Release on GitHub with a tag like <code className="text-zinc-200 font-mono">v2.6.0</code>.</li>
                    <li><strong className="text-zinc-200">Automated Installation:</strong> When an update is detected, clicking "Update Now" gracefully closes running Minecraft servers, downloads the latest release payload, applies file updates, and restarts your servers automatically.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: VAULT */}
          {activeTab === 'vault' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    Archived Servers ({archivedServers.length})
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Archived servers are kept offline and hidden from the dashboard.
                  </p>
                </div>
              </div>

              {archivedServers.length === 0 ? (
                <div className="p-8 text-center bg-zinc-900/40 border border-dashed border-zinc-800 rounded-2xl space-y-2">
                  <Archive className="w-8 h-8 text-zinc-600 mx-auto" />
                  <p className="text-xs text-zinc-400">No servers are currently in the archive vault.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {archivedServers.map((srv) => (
                    <div
                      key={srv.id}
                      className="p-3.5 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-between gap-3"
                    >
                      <div>
                        <span className="font-bold text-xs text-zinc-200 block">{srv.name}</span>
                        <span className="text-[11px] text-zinc-500 font-mono">
                          Port {srv.port} · {srv.loader.toUpperCase()} {srv.minecraftVersion}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => unarchiveServer(srv.id)}
                          className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-600/30 rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          Restore
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmServer(srv)}
                          className="p-1.5 bg-zinc-800 hover:bg-rose-900/40 text-zinc-400 hover:text-rose-400 rounded-lg border border-zinc-700 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* PURGE SAMPLE DATA CONFIRMATION MODAL */}
      {isPurgeModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#11151c] border border-rose-900/50 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                <Eraser className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-100">Wipe All Sample Data?</h3>
                <p className="text-xs text-zinc-400">Reset to completely clean slate</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              This will remove all demo servers, mock logs, and sample alerts from your local storage. You will start with a completely empty, production-ready dashboard.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsPurgeModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold border border-zinc-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  purgeSampleData();
                  setIsPurgeModalOpen(false);
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-950/50 cursor-pointer"
              >
                Confirm & Wipe Clean
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PERMANENT DELETE MODAL */}
      {deleteConfirmServer && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#11151c] border border-rose-900/50 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-100">Permanently Delete Server?</h3>
                <p className="text-xs text-zinc-400 font-mono">{deleteConfirmServer.name}</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-white font-mono">{deleteConfirmServer.name}</strong>? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setDeleteConfirmServer(null)}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold border border-zinc-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteServer(deleteConfirmServer.id);
                  setDeleteConfirmServer(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-950/50 cursor-pointer"
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
