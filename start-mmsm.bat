@echo off
title MMSM - Minecraft Server Manager Launcher
color 0A

:: Ensure the command prompt window STAYS OPEN on any error
set "EXIT_PAUSE=1"

echo ======================================================================
echo    MMSM - MrHaydenn's Minecraft Server Manager Wrapper
echo                  Windows 11 Startup Launcher
echo ======================================================================
echo.

:: 1. Anchor working directory to script location
cd /d "%~dp0"
echo [1/4] Checking launch directory...
echo       Running from: "%~dp0"
echo.

:: 2. Locate package.json (check current folder, subfolders, or parent)
set "APP_DIR=%~dp0"
if exist "%~dp0package.json" (
    set "APP_DIR=%~dp0"
    goto FOUND_PACKAGE
)
if exist "%~dp0MMSM-main\package.json" (
    set "APP_DIR=%~dp0MMSM-main"
    cd /d "%~dp0MMSM-main"
    echo [+] Found project files inside nested MMSM-main folder.
    goto FOUND_PACKAGE
)
if exist "%~dp0..\package.json" (
    set "APP_DIR=%~dp0..\"
    cd /d "%~dp0..\"
    echo [+] Found project files in parent folder.
    goto FOUND_PACKAGE
)

:FOUND_PACKAGE
if not exist "%APP_DIR%package.json" (
    color 0C
    echo ======================================================================
    echo [ERROR] "package.json" not found in:
    echo   "%~dp0"
    echo ======================================================================
    echo.
    echo Please make sure all extracted project files (src, package.json, vite.config.ts)
    echo are in the same folder as this start-mmsm.bat script.
    echo.
    echo Press any key to close this window...
    pause
    exit /b 1
)

:: 3. Find Node.js (Check standard PATH and common Windows 11 install locations)
echo [2/4] Detecting Node.js runtime...

set "NODE_EXE="
where node >nul 2>nul
if %errorlevel% equ 0 (
    set "NODE_EXE=node"
)

if "%NODE_EXE%"=="" (
    if exist "C:\Program Files\nodejs\node.exe" (
        set "PATH=C:\Program Files\nodejs;%PATH%"
        set "NODE_EXE=C:\Program Files\nodejs\node.exe"
    ) else if exist "C:\Program Files (x86)\nodejs\node.exe" (
        set "PATH=C:\Program Files (x86)\nodejs;%PATH%"
        set "NODE_EXE=C:\Program Files (x86)\nodejs\node.exe"
    ) else if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" (
        set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
        set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
    ) else if exist "%APPDATA%\npm\node.exe" (
        set "PATH=%APPDATA%\npm;%PATH%"
        set "NODE_EXE=%APPDATA%\npm\node.exe"
    )
)

if "%NODE_EXE%"=="" (
    color 0C
    echo ======================================================================
    echo [ERROR] Node.js was not detected on this computer!
    echo ======================================================================
    echo.
    echo MMSM requires Node.js (v18 or newer) to host the server manager WebGUI.
    echo.
    echo If you just installed Node.js:
    echo   1. Windows may need to restart Explorer / your PC to refresh the PATH.
    echo   2. Or run this script from inside a newly opened Command Prompt.
    echo.
    echo Download link: https://nodejs.org/ (Download the "LTS" version)
    echo.
    echo Press any key to open the Node.js download page and close...
    pause
    start https://nodejs.org/en/download
    exit /b 1
)

echo [+] Node.js is ready!
for /f "tokens=*" %%v in ('node -v 2^>nul') do echo     Node Version: %%v
for /f "tokens=*" %%v in ('npm -v 2^>nul') do echo     NPM Version:  %%v
echo.

:: 4. Check & Install Dependencies
echo [3/4] Verifying node_modules dependencies...
if not exist "%APP_DIR%node_modules" (
    echo [MMSM] Dependencies not found. Installing node_modules (first run setup)...
    echo        Please wait while npm installs packages...
    echo.
    call npm install
    if errorlevel 1 (
        color 0C
        echo.
        echo ======================================================================
        echo [ERROR] "npm install" encountered an issue.
        echo ======================================================================
        pause
        exit /b 1
    )
    echo.
    echo [+] Dependencies installed successfully.
) else (
    echo [+] Dependencies already installed.
)
echo.

:: 5. Launch MMSM Server & WebGUI
echo [4/4] Starting MMSM Server Wrapper...
echo ======================================================================
echo   MMSM is starting on http://localhost:3000
echo   Keep this Command Prompt window open while managing servers.
echo   To stop the wrapper, press Ctrl+C in this window.
echo ======================================================================
echo.

:: Open browser after 2 second delay
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"

:: Start Vite dev server
call npm run dev

if errorlevel 1 (
    color 0C
    echo.
    echo ======================================================================
    echo [NOTICE] MMSM dev server stopped with exit code %errorlevel%.
    echo ======================================================================
)

echo.
echo Press any key to exit...
pause
