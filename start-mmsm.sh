#!/usr/bin/env bash
# MMSM - MrHaydenn's Minecraft Server Manager Shell Launcher
set -e

cd "$(dirname "$0")"

echo "======================================================================"
echo "  MMSM - MrHaydenn's Minecraft Server Manager Wrapper (Linux / macOS)"
echo "======================================================================"
echo ""

if ! command -v node >/dev/null 2>&1; then
    echo "[ERROR] Node.js is not installed or not in PATH!"
    echo "Please install Node.js (v18+) from https://nodejs.org or via package manager."
    exit 1
fi

NODE_VER=$(node -v)
NPM_VER=$(npm -v)
echo "[+] Node.js: $NODE_VER"
echo "[+] NPM:     $NPM_VER"
echo ""

if [ ! -d "node_modules" ]; then
    echo "[MMSM] Installing dependencies for first launch..."
    npm install
fi

echo "[MMSM] Launching server management wrapper on http://localhost:3000 ..."
echo ""

# Attempt to open browser
if command -v xdg-open >/dev/null 2>&1; then
    (sleep 2 && xdg-open "http://localhost:3000") &
elif command -v open >/dev/null 2>&1; then
    (sleep 2 && open "http://localhost:3000") &
fi

npm run dev
