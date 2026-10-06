#!/usr/bin/env bash
# MMSM - MrHaydenn's Minecraft Server Manager Shell Launcher (Linux / macOS / Git Bash)
set -e

# Change to script directory
cd "$(dirname "$0")"

echo "======================================================================"
echo "  MMSM - MrHaydenn's Minecraft Server Manager Wrapper"
echo "======================================================================"
echo ""

# Find package.json (handling nested directory)
if [ ! -f "package.json" ]; then
    if [ -f "MMSM-main/package.json" ]; then
        cd MMSM-main
    elif [ -f "../package.json" ]; then
        cd ..
    else
        echo "[ERROR] package.json not found in $(pwd)"
        echo "Please make sure you extracted all project files."
        exit 1
    fi
fi

NODE_VER=$(node -v 2>/dev/null || echo "not_found")
NPM_VER=$(npm -v 2>/dev/null || echo "not_found")

if [ "$NODE_VER" = "not_found" ]; then
    echo "[ERROR] Node.js is not installed or not in PATH!"
    echo "Please install Node.js (v18+) from https://nodejs.org/"
    exit 1
fi

echo "[+] Node.js: $NODE_VER"
echo "[+] NPM:     $NPM_VER"
echo ""

if [ ! -d "node_modules" ]; then
    echo "[MMSM] Installing dependencies for first launch..."
    npm install --legacy-peer-deps || npm install --force
    echo "[+] Dependencies installed."
    echo ""
fi

echo "======================================================================"
echo "  Starting MMSM WebGUI on http://localhost:3000"
echo "  Press Ctrl+C to stop the manager wrapper."
echo "======================================================================"
echo ""

# Try opening default browser on macOS (open), Linux (xdg-open), or Windows Git Bash (start)
if command -v open >/dev/null 2>&1; then
    (sleep 2 && open http://localhost:3000) &
elif command -v xdg-open >/dev/null 2>&1; then
    (sleep 2 && xdg-open http://localhost:3000) &
elif command -v start >/dev/null 2>&1; then
    (sleep 2 && start http://localhost:3000) &
fi

npm run dev
