# MMSM - MrHaydenn's Minecraft Server Manager PowerShell Launcher
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
