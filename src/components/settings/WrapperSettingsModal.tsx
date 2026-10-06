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
} from 'lucide-react';
import { useServer } from '../../context/ServerContext';
import { useAuth } from '../../context/AuthContext';
import { MinecraftServer } from '../../types/server';

interface WrapperSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'general' | 'networking' | 'updater' | 'launcher' | 'vault';
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
    wrapperSettings,
    updateWrapperSettings,
    checkForGitHubUpdate,
    performGitHubUpdate,
    isUpdatingWrapper,
    updateProgressStep,
  } = useServer();
  const { canPerformAction } = useAuth();

  const [activeTab, setActiveTab] = useState<'general' | 'networking' | 'updater' | 'launcher' | 'vault'>(
    initialTab
  );
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [deleteConfirmServer, setDeleteConfirmServer] = useState<MinecraftServer | null>(null);
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
setlocal enabledelayedexpansion
title MMSM - Minecraft Server Manager Wrapper
color 0A
cls

:: Ensure execution from the script's exact folder
cd /d "%~dp0"

echo ======================================================================
echo   MMSM - MrHaydenn's Minecraft Server Manager Wrapper
echo ======================================================================
echo.
echo [1/3] Verifying Node.js and NPM environment...

where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo ======================================================================
    echo [ERROR] Node.js is NOT found in your Windows PATH!
    echo ======================================================================
    echo.
    echo To fix this:
    echo 1. Download and install Node.js (LTS version recommended) from:
    echo    https://nodejs.org/
    echo 2. When installing, make sure "Add to PATH" is checked.
    echo 3. Restart your Command Prompt or Terminal and try again.
    echo.
    echo Press any key to close this window...
    pause >nul
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v 2^>nul') do set NODE_VERSION=%%i
for /f "tokens=*" %%i in ('npm -v 2^>nul') do set NPM_VERSION=%%i

echo [+] Node.js detected: !NODE_VERSION!
echo [+] NPM detected:     !NPM_VERSION!
echo [+] Working Dir:     %~dp0
echo.

:: Check dependencies
if not exist "node_modules\\" (
    echo [2/3] Installing application dependencies (first time setup)...
    echo Please wait while npm packages are installed...
    call npm install
    if !errorlevel! neq 0 (
        color 0C
        echo.
        echo [ERROR] npm install encountered an error. Please inspect output.
        pause
        exit /b 1
    )
    echo [+] Dependencies installed successfully.
    echo.
) else (
    echo [2/3] Dependencies verified.
)

:: Launch web interface & dev server
echo [3/3] Starting MMSM WebGUI server on http://localhost:3000 ...
echo.
echo ======================================================================
echo   MMSM is now running!
echo   Web Interface URL: http://localhost:3000
echo   Press Ctrl+C in this window to stop the wrapper server.
echo ======================================================================
echo.

:: Open default browser after 2 seconds in background
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"

:: Start dev server using call so CMD does not exit when npm finishes
call npm run dev

if %errorlevel% neq 0 (
    color 0C
    echo.
    echo ======================================================================
    echo [NOTICE] MMSM server process has stopped or exited.
    echo ======================================================================
    echo.
)

pause
`;

  // PowerShell Runner
  const ps1ScriptContent = `# MMSM - MrHaydenn's Minecraft Server Manager PowerShell Launcher
$Host.UI.RawUI.WindowTitle = "MMSM - Minecraft Server Manager Wrapper"
Set-Location -Path $PSScriptRoot

Write-Host "======================================================================" -ForegroundColor Green
Write-Host "  MMSM - MrHaydenn's Minecraft Server Manager Wrapper" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
Write-Host ""

Write-Host "[1/3] Checking Node.js runtime..." -ForegroundColor Cyan
try {
    $nodeVer = & node -v
    $npmVer = & npm -v
    Write-Host "[+] Node.js version: $nodeVer" -ForegroundColor Green
    Write-Host "[+] NPM version:     $npmVer" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "[ERROR] Node.js is not installed or not in PATH!" -ForegroundColor Red
    Write-Host "Please download Node.js (LTS) from https://nodejs.org/" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

if (-not (Test-Path -Path "node_modules")) {
    Write-Host "[2/3] Installing dependencies for first-time launch..." -ForegroundColor Cyan
    npm install
} else {
    Write-Host "[2/3] Dependencies found." -ForegroundColor Cyan
}

Write-Host "[3/3] Starting MMSM WebGUI on http://localhost:3000 ..." -ForegroundColor Cyan
Write-Host ""
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "  MMSM is active! Open http://localhost:3000 in your browser." -ForegroundColor Green
Write-Host "  Press Ctrl+C in this PowerShell window to stop the server." -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
Write-Host ""

Start-Process "http://localhost:3000"
npm run dev

Read-Host "MMSM process ended. Press Enter to close"
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

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-[#11151c] border border-zinc-800 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col overflow-hidden max-h-[88vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <span>MMSM Wrapper Settings</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                  {wrapperSettings.githubUpdate.currentVersion}
                </span>
              </h2>
              <p className="text-xs text-zinc-400">Global launcher preferences, network bindings, updates & vaults</p>
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
            <span>GitHub Auto-Updater</span>
            {wrapperSettings.githubUpdate.hasUpdate && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('launcher')}
            className={`px-3.5 py-2 border-b-2 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'launcher'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Standalone Launchers (.bat / .exe)</span>
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
            <span>Archived Servers ({archivedServers.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {saveSuccess && (
            <div className="p-3.5 bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 rounded-xl flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Wrapper settings saved successfully!</span>
            </div>
          )}

          {/* TAB 1: GENERAL */}
          {activeTab === 'general' && (
            <form onSubmit={handleSave} className="space-y-6">
              {/* Directory Paths Configuration */}
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
                      <span className="text-[10px] text-zinc-500 font-mono">Each server created in its own folder</span>
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

          {/* TAB 2: NETWORKING & WEBGUI PORT */}
          {activeTab === 'networking' && (
            <form onSubmit={handleSave} className="space-y-6">
              {/* WebGUI Port & Binding */}
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
                      Access the web dashboard at: <strong className="text-emerald-400">http://localhost:{wrapperSettings.wrapperWebPort || 3000}</strong>
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
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 font-mono focus:outline-none"
                    >
                      <option value="0.0.0.0">0.0.0.0 (All Interfaces - LAN & WAN access)</option>
                      <option value="127.0.0.1">127.0.0.1 (Localhost only - No external access)</option>
                    </select>
                    <p className="text-[11px] text-zinc-500 font-mono">
                      Allows managing servers from other computers on your home/office network.
                    </p>
                  </div>
                </div>
              </div>

              {/* Public Player Connection IP / Domain */}
              <div className="p-4 bg-zinc-900/80 rounded-xl border border-zinc-800 space-y-4">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-zinc-200 uppercase tracking-wide">
                    Public Game Connection IP / Domain
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <label className="text-zinc-300 font-medium">Public IP / Hostname for Players</label>
                  <input
                    type="text"
                    placeholder="e.g. play.craftyfleet.com or 142.250.190.46"
                    value={wrapperSettings.publicIp || ''}
                    onChange={(e) => updateWrapperSettings({ publicIp: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[11px] text-zinc-500 font-mono">
                    This public hostname is shown on each server dashboard card so players can easily copy the server address.
                  </p>
                </div>
              </div>

              {/* Server Auto-Allocation Port Range */}
              <div className="p-4 bg-zinc-900/80 rounded-xl border border-zinc-800 space-y-4">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-zinc-200 uppercase tracking-wide">
                    Minecraft Instance Port Range Auto-Allocation
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  <div className="space-y-1.5">
                    <label className="text-zinc-400 block font-sans">Start Port</label>
                    <input
                      type="number"
                      value={wrapperSettings.portRangeStart}
                      onChange={(e) =>
                        updateWrapperSettings({ portRangeStart: Number(e.target.value) })
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-zinc-400 block font-sans">End Port</label>
                    <input
                      type="number"
                      value={wrapperSettings.portRangeEnd}
                      onChange={(e) =>
                        updateWrapperSettings({ portRangeEnd: Number(e.target.value) })
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none"
                    />
                  </div>
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

          {/* TAB 3: GITHUB AUTO-UPDATER */}
          {activeTab === 'updater' && (
            <div className="space-y-6">
              {/* Updater Status Card */}
              <div className="p-5 bg-zinc-900/90 border border-zinc-800 rounded-xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <GitBranch className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                        <span>GitHub Release Sync</span>
                        {wrapperSettings.githubUpdate.hasUpdate ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-800 text-emerald-400 font-bold">
                            Update Available: {wrapperSettings.githubUpdate.latestVersion}
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                            Up to date ({wrapperSettings.githubUpdate.currentVersion})
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-zinc-400">
                        Repository: <a href={wrapperSettings.githubUpdate.repoUrl} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline font-mono">{wrapperSettings.githubUpdate.repoUrl}</a>
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCheckUpdatesNow}
                    disabled={isCheckingUpdate || isUpdatingWrapper}
                    className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-2 border border-zinc-700 cursor-pointer transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin text-emerald-400' : ''}`} />
                    <span>{isCheckingUpdate ? 'Checking GitHub...' : 'Check for Updates'}</span>
                  </button>
                </div>

                {updateCheckNotice && (
                  <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 rounded-lg flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{updateCheckNotice}</span>
                  </div>
                )}
              </div>

              {/* Available Update Details & Action */}
              {wrapperSettings.githubUpdate.hasUpdate && (
                <div className="p-5 bg-gradient-to-br from-emerald-950/40 via-zinc-900 to-zinc-900 border border-emerald-800/60 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-emerald-400">
                        Latest GitHub Release
                      </span>
                      <h4 className="text-sm font-bold text-zinc-100 mt-0.5">
                        {wrapperSettings.githubUpdate.releaseTitle || `MMSM Release ${wrapperSettings.githubUpdate.latestVersion}`}
                      </h4>
                      <p className="text-xs text-zinc-400 font-mono">
                        Published {wrapperSettings.githubUpdate.publishedAt || 'recently'}
                      </p>
                    </div>
                  </div>

                  {/* Release Notes */}
                  <div className="p-3.5 bg-zinc-950/90 border border-zinc-800 rounded-lg text-xs text-zinc-300 font-mono whitespace-pre-line leading-relaxed">
                    {wrapperSettings.githubUpdate.releaseNotes}
                  </div>

                  {/* Graceful Safety Warning */}
                  <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-lg flex items-start gap-2.5 text-xs text-amber-300">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p>
                      <strong>Graceful Fleet Shutdown:</strong> When you update, MMSM will broadcast a warning to all connected players, gracefully stop all {onlineCount} online Minecraft server(s), apply the update from GitHub, and restart cleanly.
                    </p>
                  </div>

                  {/* Trigger Update Button */}
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-4 text-xs text-zinc-400">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={wrapperSettings.githubUpdate.autoRestartServersAfterUpdate}
                          onChange={(e) =>
                            updateWrapperSettings({
                              githubUpdate: {
                                ...wrapperSettings.githubUpdate,
                                autoRestartServersAfterUpdate: e.target.checked,
                              },
                            })
                          }
                          className="accent-emerald-500 rounded"
                        />
                        <span>Auto-restart servers after update</span>
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={() => performGitHubUpdate()}
                      disabled={isUpdatingWrapper}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/50 flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                    >
                      {isUpdatingWrapper ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Applying Update...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          <span>Update Launcher Now ({wrapperSettings.githubUpdate.latestVersion})</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Live Upgrade Progress Modal / Overlay */}
              {isUpdatingWrapper && (
                <div className="p-5 bg-zinc-900 border border-emerald-500/50 rounded-xl space-y-3 animate-pulse">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
                    <div>
                      <p className="text-xs font-bold text-zinc-100">Automated Update in Progress</p>
                      <p className="text-xs text-emerald-400 font-mono">{updateProgressStep}</p>
                    </div>
                  </div>
                  <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full w-3/4 animate-pulse" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: STANDALONE LAUNCHERS (.BAT / CMD / .EXE) */}
          {activeTab === 'launcher' && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-zinc-200">Standalone Startup Launcher (.bat & CMD)</h3>
                <p className="text-xs text-zinc-400">
                  Run this wrapper easily on Windows 11 / 10, Linux or macOS by launching the batch script or terminal command.
                </p>
              </div>

              {/* Windows 11 Fix Explanation & One-Click Download Box */}
              <div className="p-4 bg-emerald-950/20 border border-emerald-800/40 rounded-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Terminal className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-zinc-100">start-mmsm.bat (Windows 11 / 10 Launcher)</h4>
                      <p className="text-[11px] text-zinc-400">
                        Anchored to project root directory with <code className="text-emerald-400 font-mono">cd /d "%~dp0"</code> and <code className="text-emerald-400 font-mono">call npm run dev</code> so it never closes unexpectedly.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadLauncher}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950/40 flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download .bat</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadPs1}
                      className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 border border-zinc-700 cursor-pointer transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download .ps1</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Windows 11 Instant-Close Diagnosis & Solution */}
              <div className="p-4 bg-zinc-900/70 border border-zinc-800 rounded-xl space-y-2 text-xs text-zinc-300">
                <p className="font-bold text-zinc-100 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-emerald-400" />
                  <span>Why did the previous .bat file instantly close on Windows 11?</span>
                </p>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-zinc-400 leading-relaxed font-mono">
                  <li>
                    <strong>Working directory mismatch:</strong> Double-clicking batch files from Windows Explorer can launch with working directory set to System32 instead of the app folder.
                  </li>
                  <li>
                    <strong>Process chaining without CALL:</strong> Running <code className="text-zinc-200">npm run dev</code> directly in CMD terminates the batch file when npm finishes or throws an error.
                  </li>
                  <li>
                    <strong>The Fix:</strong> The new <strong className="text-emerald-400">start-mmsm.bat</strong> uses <code className="text-zinc-200">cd /d "%~dp0"</code> to anchor the folder, checks Node.js/NPM in PATH, and runs <code className="text-zinc-200">call npm run dev</code> followed by <code className="text-zinc-200">pause</code> so the command prompt stays open even if an error occurs.
                  </li>
                </ul>
              </div>

              {/* Script Code Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                  <span>Batch Script Contents (start-mmsm.bat):</span>
                  <button
                    type="button"
                    onClick={handleCopyBatch}
                    className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 cursor-pointer font-sans"
                  >
                    {copiedBatch ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedBatch ? 'Copied!' : 'Copy Script'}</span>
                  </button>
                </div>

                <pre className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-[11px] font-mono text-zinc-300 overflow-x-auto leading-relaxed max-h-48 overflow-y-auto">
                  {batchScriptContent}
                </pre>
              </div>

              {/* Quick Launch Steps */}
              <div className="p-4 bg-zinc-900/60 rounded-xl border border-zinc-800 space-y-2 text-xs text-zinc-400">
                <p className="font-semibold text-zinc-200">Quick start instructions:</p>
                <ol className="list-decimal list-inside space-y-1 font-mono text-[11px]">
                  <li>Download or copy the project files to your PC.</li>
                  <li>Ensure Node.js (v18+) is installed from <a href="https://nodejs.org" target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">nodejs.org</a>.</li>
                  <li>Double click <strong className="text-emerald-400">start-mmsm.bat</strong> (or run <code className="text-zinc-200">start-mmsm.ps1</code> in PowerShell).</li>
                  <li>MMSM WebGUI opens automatically in your browser at <strong className="text-zinc-200">http://localhost:3000</strong>.</li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 5: ARCHIVED SERVERS VAULT */}
          {activeTab === 'vault' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    Archived Servers ({archivedServers.length})
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Archived servers are kept offline and hidden from the dashboard. You can restore them anytime.
                  </p>
                </div>
              </div>

              {archivedServers.length === 0 ? (
                <div className="p-8 text-center bg-zinc-900/40 border border-dashed border-zinc-800 rounded-2xl space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-zinc-800/80 flex items-center justify-center mx-auto text-zinc-500">
                    <Archive className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-zinc-300">No Archived Servers</p>
                    <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                      All your configured servers are currently active on the main dashboard. To archive a server, click the Archive button on any server card.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {archivedServers.map((srv) => (
                    <div
                      key={srv.id}
                      className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl flex flex-wrap items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-zinc-600" />
                          <h4 className="text-sm font-bold text-zinc-200">{srv.name}</h4>
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                            Archived
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 font-mono">
                          {srv.loader.toUpperCase()} {srv.loaderVersion} · MC {srv.minecraftVersion} · Port :{srv.port} · {srv.mods.length} mods
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => unarchiveServer(srv.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-600/30 text-xs font-semibold transition-colors cursor-pointer"
                          title="Restore server back to active dashboard"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Restore Server</span>
                        </button>

                        {canPerformAction('manage_servers') && (
                          <button
                            onClick={() => setDeleteConfirmServer(srv)}
                            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-rose-950/40 text-zinc-500 hover:text-rose-400 border border-zinc-800 transition-colors cursor-pointer"
                            title="Permanently Delete"
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
        </div>
      </div>

      {/* IN-APP CONFIRMATION MODAL FOR DELETING ARCHIVED SERVER */}
      {deleteConfirmServer && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#11151c] border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-100">Permanently Delete Server?</h3>
                <p className="text-xs text-zinc-400">Irreversible file deletion warning</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-white font-mono">{deleteConfirmServer.name}</strong>?
              All world files, configuration data, playerdata, and installed mods will be permanently erased.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setDeleteConfirmServer(null)}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold border border-zinc-800 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteServer(deleteConfirmServer.id);
                  setDeleteConfirmServer(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-950/40 cursor-pointer transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
