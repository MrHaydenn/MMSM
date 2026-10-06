# MMSM - MrHaydenn's Minecraft Server Manager PowerShell Launcher
$ErrorActionPreference = "Continue"

try {
    $Host.UI.RawUI.WindowTitle = "MMSM - Minecraft Server Manager Wrapper"
} catch {}

Set-Location -Path $PSScriptRoot

Write-Host "======================================================================" -ForegroundColor Green
Write-Host "  MMSM - MrHaydenn's Minecraft Server Manager Wrapper" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Current Directory: $PSScriptRoot" -ForegroundColor Gray
Write-Host ""

# Check for package.json in current or nested directory
if (-not (Test-Path "package.json")) {
    if (Test-Path "MMSM-main\package.json") {
        Set-Location -Path "MMSM-main"
        Write-Host "[+] Switched to nested MMSM-main directory." -ForegroundColor Green
    } elseif (Test-Path "..\package.json") {
        Set-Location -Path ".."
        Write-Host "[+] Switched to parent directory." -ForegroundColor Green
    } else {
        Write-Host "[ERROR] package.json not found in $PSScriptRoot" -ForegroundColor Red
        Write-Host "Make sure you extracted all project files before running." -ForegroundColor Yellow
        Read-Host "Press Enter to exit"
        exit 1
    }
}

Write-Host "[1/3] Checking Node.js runtime..." -ForegroundColor Cyan
$nodeFound = $false
try {
    $nodeVer = & node -v 2>$null
    $npmVer = & npm -v 2>$null
    if ($nodeVer) {
        Write-Host "[+] Node.js version: $nodeVer" -ForegroundColor Green
        Write-Host "[+] NPM version:     $npmVer" -ForegroundColor Green
        $nodeFound = $true
    }
} catch {
    $nodeFound = $false
}

if (-not $nodeFound) {
    # Check default ProgramFiles location
    if (Test-Path "C:\Program Files\nodejs\node.exe") {
        $env:Path = "C:\Program Files\nodejs;$env:Path"
        $nodeVer = & node -v
        Write-Host "[+] Located Node.js in Program Files: $nodeVer" -ForegroundColor Green
        $nodeFound = $true
    }
}

if (-not $nodeFound) {
    Write-Host ""
    Write-Host "[ERROR] Node.js is not installed or not in PATH!" -ForegroundColor Red
    Write-Host "Please download Node.js (LTS) from https://nodejs.org/" -ForegroundColor Yellow
    Write-Host "If you just installed Node.js, please restart your terminal or computer." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

if (-not (Test-Path -Path "node_modules")) {
    Write-Host "[2/3] Installing dependencies for first-time launch..." -ForegroundColor Cyan
    npm install
} else {
    Write-Host "[2/3] Dependencies found (node_modules present)." -ForegroundColor Cyan
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
