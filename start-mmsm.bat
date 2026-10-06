@echo off
setlocal enabledelayedexpansion
title MMSM - Minecraft Server Manager Wrapper
color 0A
cls

:: Ensure execution from the script's exact directory
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
if not exist "node_modules\" (
    echo [2/3] Installing application dependencies (first time setup)...
    echo Please wait while npm packages are installed...
    call npm install
    if !errorlevel! neq 0 (
        color 0C
        echo.
        echo [ERROR] npm install encountered an error. Please inspect above output.
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
