@echo off
setlocal enabledelayedexpansion
title MMSM - Minecraft Server Manager Wrapper
color 0A
cls

:: Anchor execution directory to the script's exact folder
cd /d "%~dp0"

echo ======================================================================
echo   MMSM - MrHaydenn's Minecraft Server Manager Wrapper
echo ======================================================================
echo.
echo Current Directory: %~dp0
echo.

:: 1. CHECK IF PROJECT FILES EXIST IN THIS FOLDER
if not exist "%~dp0package.json" (
    color 0C
    echo ======================================================================
    echo [ERROR] Project files not found in this folder!
    echo ======================================================================
    echo.
    echo It looks like you ran start-mmsm.bat from:
    echo   "%~dp0"
    echo.
    echo But "package.json" was not found here.
    echo.
    echo SOLUTION:
    echo 1. Make sure you extracted / copied all MMSM project files into a folder.
    echo 2. Place this "start-mmsm.bat" file inside that same folder (next to package.json).
    echo 3. Double-click start-mmsm.bat again.
    echo.
    echo ======================================================================
    pause
    exit /b 1
)

:: 2. DETECT NODE.JS & CHECK COMMON INSTALL PATHS
set "NODE_CMD="

where node >nul 2>nul
if %errorlevel% equ 0 (
    set "NODE_CMD=node"
) else (
    if exist "%ProgramFiles%\nodejs\node.exe" (
        set "PATH=%ProgramFiles%\nodejs;%PATH%"
        set "NODE_CMD=%ProgramFiles%\nodejs\node.exe"
    ) else if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
        set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"
        set "NODE_CMD=%ProgramFiles(x86)%\nodejs\node.exe"
    ) else if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" (
        set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
        set "NODE_CMD=%LOCALAPPDATA%\Programs\nodejs\node.exe"
    )
)

if "%NODE_CMD%"=="" (
    color 0C
    echo ======================================================================
    echo [ERROR] Node.js is NOT installed or not recognized!
    echo ======================================================================
    echo.
    echo MMSM requires Node.js (v18 or newer) to run the management wrapper.
    echo.
    echo Steps to resolve:
    echo 1. Go to https://nodejs.org/ and download the "LTS" installer.
    echo 2. Run the installer and ensure "Add to PATH" is checked.
    echo 3. Restart your computer or restart this terminal window.
    echo.
    echo ======================================================================
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v 2^>nul') do set "NODE_VERSION=%%i"
for /f "tokens=*" %%i in ('npm -v 2^>nul') do set "NPM_VERSION=%%i"

echo [+] Node.js detected: %NODE_VERSION%
echo [+] NPM detected:     %NPM_VERSION%
echo.

:: 3. INSTALL DEPENDENCIES IF NEEDED
if not exist "%~dp0node_modules\" (
    echo [MMSM] First-time setup: Installing required dependencies...
    echo Please wait, this may take 30-60 seconds...
    echo.
    call npm install
    if !errorlevel! neq 0 (
        color 0C
        echo.
        echo [ERROR] Dependency installation failed! Please check above output.
        pause
        exit /b 1
    )
    echo.
    echo [+] Dependencies installed successfully!
    echo.
) else (
    echo [+] Dependencies verified (node_modules present).
)

:: 4. START DEV SERVER & BROWSER
echo ======================================================================
echo   Starting MMSM WebGUI Dashboard on http://localhost:3000
echo ======================================================================
echo.
echo Launching default browser in 2 seconds...
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"

echo Running MMSM server... (Press Ctrl+C to stop)
echo.

call npm run dev

if %errorlevel% neq 0 (
    color 0C
    echo.
    echo ======================================================================
    echo [NOTICE] Server process exited with code %errorlevel%.
    echo ======================================================================
)

echo.
echo Press any key to exit...
pause >nul
