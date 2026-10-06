@echo off
title MMSM Diagnostic Launcher (Debug Mode)
color 0E
cls

echo ======================================================================
echo   MMSM Debug & Diagnostics Runner
echo ======================================================================
echo.
echo Current Working Directory: %CD%
echo Script Directory:          %~dp0
echo.

cd /d "%~dp0"
echo Changed to script folder:  %CD%
echo.

echo Checking files:
if exist "%~dp0package.json" (
    echo [OK] package.json is present.
) else (
    echo [FAIL] package.json is MISSING in %~dp0!
    echo Please make sure this file is placed in the project root folder.
)

if exist "%~dp0node_modules" (
    echo [OK] node_modules folder exists.
) else (
    echo [INFO] node_modules not found yet. Will run npm install.
)

echo.
echo Testing Node & NPM in PATH:
where node
if %errorlevel% neq 0 (
    echo [WARN] node not in PATH directly. Searching standard paths...
    if exist "%ProgramFiles%\nodejs\node.exe" (
        echo [OK] Found in %ProgramFiles%\nodejs
        set "PATH=%ProgramFiles%\nodejs;%PATH%"
    )
)

where npm
echo.
echo Node Version:
node -v
echo NPM Version:
npm -v
echo.
echo Starting MMSM Dev Server...
echo ======================================================================
call npm run dev
echo.
echo ======================================================================
echo Execution complete.
pause
