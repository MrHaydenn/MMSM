@echo off
title MMSM - MrHaydenn's Minecraft Server Manager
color 0A
cls
echo ===================================================
echo   Starting MMSM - Minecraft Server Manager Wrapper
echo ===================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js (v18+) from https://nodejs.org
    pause
    exit /b
)

if not exist node_modules (
    echo [MMSM] Installing dependencies (first run)...
    call npm install
)

echo [MMSM] Launching server management wrapper on http://localhost:3000 ...
start http://localhost:3000
npm run dev
pause
