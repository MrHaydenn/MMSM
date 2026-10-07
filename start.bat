@echo off
cd /d "%~dp0"
rem Uses saved network settings; defaults to all interfaces on port 11015.
rem Public URL for HTTPS can be saved in Settings. Arguments below remain optional.
py -3.12 -m mmsm %*
if errorlevel 1 pause
