@echo off
title MMSM Launcher Diagnostic & Runner
color 0B

echo ======================================================================
echo              MMSM Windows 11 Diagnostic Launcher
echo ======================================================================
echo.

cd /d "%~dp0"
echo Current directory: %cd%
echo Checking files in current directory:
dir /b package.json 2>nul
if %errorlevel% neq 0 (
    echo [!] package.json is NOT in %cd%
    echo Let's search subdirectories:
    dir /b /s package.json 2>nul
) else (
    echo [+] package.json found!
)

echo.
echo Checking Node.js:
where node
if %errorlevel% neq 0 (
    echo [!] "where node" failed. Trying C:\Program Files\nodejs\node.exe
    if exist "C:\Program Files\nodejs\node.exe" (
        echo [+] Found Node at C:\Program Files\nodejs\node.exe
        set "PATH=C:\Program Files\nodejs;%PATH%"
    )
)

echo.
echo Running node -v:
node -v
echo Running npm -v:
npm -v

echo.
echo Starting MMSM with npm run dev:
echo ----------------------------------------------------------------------
call npm run dev

echo.
echo ----------------------------------------------------------------------
echo MMSM exited with code: %errorlevel%
echo.
echo Press any key to close this diagnostic window...
pause
