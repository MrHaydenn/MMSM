@echo off
setlocal enabledelayedexpansion
title MMSM - Minecraft Server Manager Launcher
color 0A

:: Ensure correct directory
cd /d "%~dp0"

:: Append common Windows Node.js installation paths to environment PATH
set "PATH=%PATH%;C:\Program Files\nodejs;C:\Program Files (x86)\nodejs;%LOCALAPPDATA%\Programs\nodejs;%APPDATA%\npm;%USERPROFILE%\AppData\Roaming\npm"

echo ======================================================================
echo    MMSM - MrHaydenn's Minecraft Server Manager Wrapper
echo                  Windows 11 Startup Launcher
echo ======================================================================
echo.

:: Detect if project files are inside a nested folder from zip extraction
if not exist "package.json" (
    if exist "MMSM-main\package.json" (
        cd MMSM-main
    ) else if exist "..\package.json" (
        cd ..
    )
)

:: Verify node is installed and available
where node >nul 2>nul
if errorlevel 1 (
    color 0C
    echo [ERROR] Node.js was not detected on your system.
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: Check if dependencies need installation
if not exist "node_modules\vite" (
    echo [MMSM] Installing dependencies...
    call npm install --legacy-peer-deps
    echo.
)

:: Open browser automatically
start "" "http://localhost:3000"

:: Launch Vite dev server
call npm run dev

if errorlevel 1 (
    call npx vite --port 3000 --host 0.0.0.0
)

echo.
pause
