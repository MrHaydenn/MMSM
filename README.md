# MMSM — MrHaydenn’s Minecraft Server Manager

A self-hosted Minecraft Java server manager with a browser interface, Modrinth integration, automatic Java management, account permissions, backups and join-triggered sleep.

## Install on Windows

1. Install **Python 3.12** from [python.org](https://www.python.org/downloads/windows/). Include **pip** and the **Python launcher** when installing. Verify in Command Prompt with `py -3.12 --version`.
2. Open the [latest stable release](https://github.com/MrHaydenn/MMSM/releases/latest) and download **MMSM-0.9.0.zip**. This is the full installation; the `-update.zip` asset is for MMSM's built-in updater.
3. Extract the ZIP to a writable folder, for example `C:\MMSM`. Open the extracted `mmsm` folder containing `start.bat`. Do not run from inside the ZIP or put it in Program Files.
4. Double-click **start.bat**. Keep its terminal open while using MMSM. On first startup, MMSM installs missing telemetry/image dependencies into its own `dependencies` folder; allow time and internet access for this.
5. Open **http://127.0.0.1:11015** in your browser. Copy the setup token printed in the terminal and create your owner account. After setup, only the owner can create other accounts.
6. Create a Minecraft server in the dashboard. Java is selected and downloaded automatically when needed. Review the Minecraft EULA before creating servers; automatic acceptance is enabled by default in wrapper Settings.

`start.bat` is the supplied launcher. It starts MMSM from its own folder and uses your saved settings. Fresh installs listen on all IPv4 interfaces on WebGUI port **11015**. You can change the port/listener in Settings and restart MMSM, or run `start.bat --port 11016` from Command Prompt for an explicit override. If Windows asks about firewall access, allow the networks you intend to use.

If startup fails, check `py -3.12 --version`, pip and internet access, and read the terminal error. To retry dependency installation manually from the MMSM folder:

```bat
py -3.12 -m pip install --target dependencies "psutil>=6,<8" "Pillow>=12,<14"
start.bat
```

## Upgrade an existing installation

Use **Settings → Stable → Check for updates → Update MMSM**. Stop Minecraft servers and wait for downloads, backups and other operations to finish first. The update restarts MMSM; only servers with AutoStart enabled launch afterward. Accounts, worlds and settings are preserved. Experimental builds remain opt-in and follow verified pushes; stable builds follow published releases.

For a manual upgrade, stop Minecraft and MMSM and back up the whole installation first. Extract the full release into a separate folder, then replace the old program files with the new ones while preserving **data**, **Servers**, **Backups** and **dependencies**. Keep the original data location if you use a custom path. Run `start.bat` and refresh the browser with Ctrl+F5. If you unexpectedly see owner signup, stop and check that you retained the original data folder.

## Features

- Fabric, Forge, NeoForge, Paper and vanilla creation; loader/version discovery, experimental-version filtering and backed-up runtime updates.
- Modrinth mods, plugins and modpacks; compatible version selection, dependency installation, update checks, enable/disable switches and third-party JAR uploads.
- Dashboard CPU, RAM, player and traffic statistics, historical analytics, console, files, properties, players, whitelist/bans/operators, server icons and profile images.
- Owner/admin accounts, case-insensitive login with preserved username capitalization, selected-server access and granular account/per-server permissions. Accounts granted creation permission fully control their own created servers.
- Start, graceful stop, restart, kill, AutoStart, archiving and deletion. Archived servers stay dormant and do not contribute to active statistics.
- Backup rules, destinations, retention and interval schedules; stopped-server folder sync with optional Minecraft/loader version sync.
- Download history, actionable update/player-request notifications, themes, custom launcher image and matching browser favicon.
- Generic DNS instructions and optional automatic publishing through Cloudflare or UNM. See [UNM DNS setup](docs/UNM-DNS.md).

## Sleep and sync

Sleep requires successful checks showing zero players continuously for the configured idle interval. Failed/unknown player checks reset the timer. The server page shows the countdown or why it is paused. Graceful stopping saves the world and may take additional time.

**Join mode is the default:** server-list pings stay asleep and show “Sleeping. Join the server to start it.” Optional Ping mode wakes on a Minecraft status ping or join attempt. A wake starts Java and tells the player to wait a moment and try joining again. Explicit Stop pauses automatic wake until Start or Sleep now. Server Settings shows the latest wake, the sleep countdown/reason, and an expandable history of up to 50 requests. A join handshake is not an authenticated identity; tunnels may hide the original source IP.

Sync mirrors only selected folders, such as `config` and `mods`, plus the runtime version if enabled. Sleep, RAM, idle time, AutoStart, names, server properties, public addresses and backup rules remain independent. Templates may copy initial settings once. Changes are checked every 30 seconds and applied only while both servers are stopped. Editing synced content prompts to unlink; other settings/files do not. External edits pause sync, and chained syncs/world/runtime-folder copies are blocked.

## LAN and internet access

For LAN access, use the host computer's LAN address and the WebGUI port. For public access, configure firewall/router forwarding or a reverse proxy separately. Use HTTPS for internet account access and save the exact public browser URL in wrapper Settings, for example `https://manager.example.com`. Configure the proxy to preserve the original Host header. Do not share passwords or setup tokens.

Minecraft domains are independent of the WebGUI address. Generic example: label `survival` with base `minecraft.example.com` gives `survival.minecraft.example.com`. MMSM displays the required records and can optionally publish them through a configured provider. Use your own domain and public IP; DNS does not create port forwarding, and different hostnames do not automatically share one Minecraft port. Cloudflare records for ordinary Minecraft TCP must be DNS-only.

## Data and limits

Servers live under **Servers** inside the project, with their respective names. Manager/account data lives in **data**, default backups in **Backups**, and optional Python packages in **dependencies**. Release downloads contain program/source files, not accounts, tokens, worlds, host configurations or wake histories.

MMSM handles Minecraft Java TCP. Bedrock/UDP, voice-chat UDP, Query and RCON forwarding are not implemented. Minecraft sees the local proxy as the connection IP. Permissions govern MMSM access; uploaded JARs and servers run under the host's operating-system account without an OS sandbox. Backup restoration is manual: stop the server and preserve the current folder before extracting a backup. Do not force-kill a server unless needed; unsaved changes can be lost.

## Development and releases

```bat
py -3.12 -m unittest discover -s tests -v
node --test tests/ui.test.cjs
```

Node and a Java compiler are needed for the development checks; they are not required to launch the manager. Java process tests use a test fixture, not a real modded Minecraft distribution. See [verification](docs/VERIFICATION.md) and [publishing updates](docs/RELEASING.md). Ordinary pushes publish only opt-in Experimental builds; stable releases require an explicit release request.

Wrapper Settings groups General, Archived servers and owner-only Accounts. The Overview replaces the separate Servers page. Non-administrators can use the archive section for servers visible to their account; global settings remain restricted, and restoring/deleting a server requires its specific permission. Only the owner can list, create, edit or delete accounts. Passwords no longer have a 12-character minimum, but must be nonempty and at most 256 characters. A saved UNM token is indicated without revealing its value. Launcher images can be removed to restore the default logo and favicon.
