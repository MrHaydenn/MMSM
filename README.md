# MMSM

**MrHaydenn’s Minecraft Server Manager** — a self-hosted Minecraft Java server wrapper with a WebGUI, Modrinth integration, managed Java, and wake-on-ping.

This is a working **0.8.1 release**, with source and integration tests. The backend has been exercised locally, including a real JVM protocol fixture. The Modrinth fix was checked against the live API and a real Fabric API JAR was downloaded, checksum-verified and installed into a temporary test server folder. A real Minecraft distribution was not booted for this release. Browser layout remains unverified in this environment. See [VERIFICATION.md](docs/VERIFICATION.md) for the exact test boundary.

## Upgrade from earlier versions

Your existing servers, accounts and RAM allocations are preserved. The former default port 3000 migrates once to 11015; other saved ports are preserved.

1. Gracefully stop your Minecraft servers, then stop MMSM (Ctrl+C in its terminal).
2. Make a copy of your existing `data` folder (or your custom `--data` location).
3. Extract the update somewhere temporary. Copy the contents of its top-level `mmsm` folder into your existing MMSM folder, the one containing `start.bat` and `data`. Replace the program files. **Keep your existing `data` folder; this package contains no data folder.**
4. Restart from the existing folder. On Windows you can use `start.bat --port 11015` or `py -3.12 -m mmsm --port 11015`. Continue using your existing `--data` argument if you had one.
5. Open http://127.0.0.1:11015 and refresh the page (Ctrl+F5 if needed). Sign in with your existing account. If you unexpectedly see owner signup, stop and check that MMSM is pointing at the original data directory.

For upgrades from 0.1/0.2, MMSM migrates existing `data/servers/<id>/runtime` folders to `Servers/<server name>` beside `start.bat`. Accounts, IDs, worlds, RAM and your saved web port are preserved. Duplicate/Windows-invalid folder names are disambiguated safely. Keep your original data backup until you have checked the migrated worlds. Renaming a stopped server also renames its folder.

Startup installs missing `psutil` and Pillow into `dependencies/` using this Python interpreter. If installation fails, the terminal explains it; MMSM still opens, with unsupported telemetry/image operations unavailable until the dependencies can be installed.

**Automatic EULA acceptance now defaults ON** for fresh/unset settings, as requested. An explicitly saved choice is preserved on upgrade; change it in Settings if needed. Port 11015 remains the fresh-install default.

## New in 0.8.0

- Server creation can override a duplicate public Minecraft port after a warning. Internal backend and WebGUI ports cannot be overridden. Only one server can own a shared listener: stop its current owner (including sleeping servers) before starting another.
- Server > Syncs configures a one-way mirror from another non-archived, same-loader server. Select top-level folders such as config, mods, plugins or defaultconfigs; optionally follow Minecraft/loader versions. Checks run every 30 seconds and changes wait until both servers are stopped. Sources may have multiple destinations; chained/cyclic syncs are blocked. Sources must be visible to the configuring account.
- Manual file/mod/runtime/config changes through the WebGUI warn and disconnect the destination sync only after confirmation. Edits outside MMSM pause the sync rather than being silently overwritten. Unlink and recreate it to accept replacement. One previous folder copy is retained in data/sync-backups/<server-id>; runtime updates retain the existing full runtime backup. A successful runtime update can remain applied if a subsequent folder copy fails; the sync pauses and retains its runtime backup.
- Sync includes deletions and disabled JAR state/mod metadata. Worlds, managed runtime folders and symlinks cannot be selected. Each snapshot is limited to 30,000 files / 2 GB. It is not a live world-replication or two-way merge system.
- Wrapper Settings > Minecraft domains stores the DNS zone, base subdomain and public entry-point IP. Server > Public address assigns a unique label and external TCP port and generates exact A/AAAA, CNAME and Minecraft Java SRV instructions. For example, trigon + minecraft.mrhaydenn.us becomes trigon.minecraft.mrhaydenn.us. Records must be added at your DNS provider; MMSM does not change Cloudflare, router forwarding or firewall rules. DNS-only/grey-cloud is required for ordinary Minecraft TCP. Different hostnames do not multiplex two servers on one IP/port; use distinct forwarded ports or a Minecraft-aware proxy.
- The official GitHub release feed remains the default for fresh installations; custom feeds and background-check opt-outs are preserved.

DNS reference: https://developers.cloudflare.com/dns/manage-dns-records/reference/dns-record-types/ and https://developers.cloudflare.com/dns/proxy-status/limitations/

## Earlier changes from 0.7.4

MMSM now checks the official GitHub release feed by default:
`https://github.com/MrHaydenn/MMSM/releases/latest/download/latest.json`

Existing blank feeds migrate once; custom feeds and disabled periodic checks are preserved. Settings offers Check for updates and Update MMSM, with six-hour background checks and update notifications. Installation still requires a click and stopped Minecraft servers. The verified installer preserves accounts, settings and worlds.

**Updating from 0.7.3:** paste the feed URL above into Settings, save, click Check for updates, stop Minecraft servers, then click Update MMSM. No manual ZIP replacement is needed.

## Earlier changes from 0.7.3

- Fixed public-domain login returning “Please sign in” and account/settings actions reporting CSRF errors when another application sets a parent-domain cookie containing raw JSON. MMSM now parses its own session cookies independently; unrelated cookie formats cannot hide a valid session. Duplicate session-cookie names are rejected rather than guessed. Origin checks, CSRF validation, Secure cookies and session revocation remain enforced.
- Stop MMSM, replace the program files while preserving `data`, `Servers` and backups, restart with `start.bat`, then refresh and sign in at your HTTPS Public URL. No password reset or proxy changes are required for this parsing fix.

## Earlier changes from 0.7.2

- Default WebGUI port is **11015**. On the first launch of this update, a saved old-default port of 3000 changes to 11015. Other custom ports are preserved. Later explicit changes, including choosing 3000 again, remain saved. CLI `--port` still overrides the saved value. Update your firewall/router and reverse-proxy upstream accordingly; an external Public URL is not automatically rewritten because its public port may differ from the internal port.
- Fixed account operations reporting **Origin mismatch** when using localhost or a direct IP alongside a configured Public URL. The configured URL now adds a permitted public entry point; direct IP/localhost requests validate their own HTTP origin and port. Unknown DNS hosts, unrelated origins and cross-site requests remain blocked. Proxies must preserve the public Host header.
- Fixed plain-HTTP login cookies incorrectly marked Secure merely because an HTTPS Public URL was configured. Login chooses its cookie attributes from the validated request origin. HTTP uses a separate cookie name so an old Secure cookie cannot prevent the new HTTP login cookie being set. Valid legacy sessions are still recognized.
- Sign-out revokes the selected session and expires its cookie; the UI also handles already-expired sessions cleanly. Password changes validate the existing password, revoke all account sessions and expire the current cookie. No passwords or accounts are reset by this update.

After replacing program files, run `start.bat` and open **http://127.0.0.1:11015** (or your preserved custom port). Sign in again and hard-refresh if the browser kept old JavaScript. For public IP testing use its actual forwarded port; for HTTPS use your configured domain. Use HTTPS for internet logins.

## Earlier changes from 0.7.1

- `start.bat`, `start.sh` and normal `python -m mmsm` startup default to listening on **all IPv4 network interfaces (`0.0.0.0`)**, using the saved WebGUI port (11015 for a fresh install). Existing installs without a listener preference also use this default. Explicit `--host` / `MMSM_HOST` overrides remain available.
- Direct public-IP requests are accepted when Public URL is blank, so no `--origin` argument is required for an IP-based HTTP connection. Auth, setup-token, CSRF, cross-site and unrecognized-DNS-host protections remain enabled.
- Settings includes **Listen on** (all interfaces or localhost) and **Public URL**. For HTTPS via a reverse proxy, enter the exact browser origin such as `https://mmsm.example.com`, save and restart. Startup remembers these preferences; `--origin` / `MMSM_ORIGIN` can explicitly override them. Public URL is an origin without a path, query or credentials; default ports and hostname capitalization are normalized.
- Console output displays a usable localhost URL and the actual listener address. No firewall, router, DNS, proxy configuration or certificates are changed automatically.

**Use:** stop MMSM, replace program files while preserving your data/server folders, then double-click `start.bat`. Forward the desired external port to the MMSM computer's LAN IP and saved WebGUI port, and allow that port in its firewall. Forwarding to another application such as Nginx Proxy Manager's API will still reach that application. For HTTPS, point the proxy's HTTP upstream to the MMSM computer/port, preserve the public Host header and set MMSM's Public URL to the HTTPS address. Use HTTPS for internet logins.

## Earlier changes from 0.7

- **Installed → Upload JAR** accepts one or more local `.jar` files (up to 512 MB each). Stop the server first. Fabric/Forge/NeoForge place them in `mods`; Paper uses `plugins`. Vanilla remains blocked. Uploaded JARs appear immediately with a grey **Third-party** label and can be toggled locally. They are never matched, updated or synchronized with Modrinth.
- Modrinth projects show a green **Modrinth** label. They retain their project links, version selector and update tracking.
- Small **Required by: …** notes identify which installed Modrinth projects depend on a library. Parent projects also show **Requires: …**. These are direct required dependencies declared by the installed Modrinth version, not guesses from filenames. Multiple parents are listed, with disabled parents marked. New installs/updates record relationships immediately; click **Check updates** to populate relationships for older installed entries, or wait for the automatic check. Local JAR dependency metadata is not inferred.
- Enable/disable is now an accessible checkbox switch with an Enabled/Disabled label. It uses the same `.jar` ↔ `.jar.disabled` behavior. File renames are rolled back if saving metadata fails, and failed switch requests restore the displayed checked state.
- Local uploads reject non-JAR filenames, invalid ZIP containers, traversal, existing enabled/disabled filenames and already-tracked filename collisions. Interrupted/failed uploads do not leave a registered partial project. A valid ZIP/JAR container does not establish loader compatibility or safety; MMSM does not execute an upload to inspect it. Dependencies and compatible local JAR selection remain manual.

## Earlier changes from 0.6

- Narrower desktop sidebar, no Workspace navbar label, fixed order (Overview, Servers, Archive, Analytics, Accounts, Settings), and no drag/reorder code or preference endpoint. Previously saved orders are ignored.
- The server page keeps the compact status badge shown in your screenshot, now with a matching status icon. The large duplicate status banner is removed. Busy/crash detail and Copy error logs remain available; Back to servers sits above the title at the left.
- Vanilla hides the redundant loader-build field in creation/runtime dialogs, while retaining the server-type selector so you can choose another type. Creation automatically uses the chosen Minecraft release as Vanilla's runtime version. Mod and modpack installation endpoints refuse Vanilla with guidance to use Fabric, NeoForge or Forge; plugins require Paper. No automatic conversion of existing worlds is attempted.
- Compact Search sits between the Modrinth query and project-type dropdown.
- Appearance uses five full palettes: **Forest, Midnight blue, Amethyst, Ember and Slate**. They change backgrounds, panels, text, borders, navigation and hover states. Custom color inputs/API settings are removed; older stored color values are ignored.
- **MMSM updates** in Settings: public HTTPS release feed, Check for updates, Update MMSM, and optional six-hour checks (enabled by default once a feed is configured). Available updates create a notification linking to Settings. Nothing downloads or installs automatically beyond the small release manifest; installation requires your Update click.
- The updater requires all Minecraft servers stopped and operations finished. It checks the package SHA-256, paths, size limits, Python syntax and embedded version; stages program files; stops/restarts MMSM; and reloads the browser after reconnection. Accounts, sessions, settings, worlds, archives, dependencies and saved port stay in place. AutoStart servers start after restart. One previous program backup is kept under `data/updates/rollback`; failed file replacement rolls back. This is not an automatic health rollback if a future release starts but contains an application bug.

**Official releases are published on GitHub; the default feed above follows the latest stable release.** See [RELEASING.md](docs/RELEASING.md) for building and publishing a version you approve. Install 0.6 manually once to get the updater.

## Earlier changes from 0.5

- **Crash detection:** JVM launch failures and unexpected exits during startup or play show Crashed, including an unexpected zero exit code. Intentional Stop, console `stop`, Sleep and Kill do not show as crashes. Crashes pause ping wake and remain visible after restarting MMSM. Copy error logs in the header/console copies runtime context and up to 2,000 recent console lines; ordinary HTTP has a selectable-text fallback. One latest crash report per server is retained in `data/crashes`. A still-running but unresponsive JVM is not automatically killed or declared crashed.
- **Status:** light-blue moon for sleep, purple broken-link symbol for crashes, green dot online and red stopped. A live status bar explains starting, saving/stopping, backing up and other operations across every server section. The tab bar is more compact.
- **Stop race fixed:** an idle-sleep task queued before Stop can no longer re-arm wake afterward. Stop also cancels queued wake/AutoStart, restart continuation and backup resume; its intent is recorded before waiting for backup file locks. Automatic start/restart/sleep schedules stay paused until explicit Start or Sleep now. A configured AutoStart is a new startup instruction on the next MMSM launch.
- **AutoStart with MMSM:** per-server setting, off unless selected. Only installed, non-archived selected servers start, after the WebGUI successfully binds. To boot them with the computer, configure the host to launch MMSM at boot. A saved manual Stop from a previous manager run does not disable an explicitly selected AutoStart.
- **Console:** auto-scroll toggle and Copy error logs. Turning auto-scroll off preserves your reading position.
- **Files:** delete folders with an explicit confirmation and recoverable copy, including removal of affected mod tracking. Protected runtime paths, symlinks, server-root deletion and live-server writes stay blocked. Back navigation moves to the left.
- **Properties:** instant text filtering by property name, preserving hidden field values when saved.
- **Mods & Plugins:** Modrinth links open project pages in a new tab; installed projects have Change version using the compatible-version modal. Search offers Mods, Plugins and Modpacks plus Most downloaded (default), Relevance, Most followed, Newest and Recently updated. Plugin discovery uses Paper/Spigot/Bukkit facets, while installation still enforces the selected server's loader and Minecraft version. These plugins cannot be installed into Fabric/Forge/NeoForge.
- **Navigation:** drag sidebar items to reorder, or use Alt+Up/Down while focusing one. Order is saved per account. Archive precedes Analytics by default. Removed the redundant Manage button on dashboard cards and View archive shortcut in global Settings.
- **Version discovery:** Minecraft/loader catalogs are fetched from upstream with a five-minute response cache, so newly published supported releases become selectable. Background release checks default to six hours (configurable). Stable versions show by default; experimental versions remain opt-in. MMSM never automatically upgrades worlds.

## Earlier changes from 0.4

- **Modrinth root cause fixed:** search hits include a `versions` array of Minecraft version strings. Older MMSM code mistook it for downloadable version objects, skipped the detail request, and displayed blank “release” entries. Downloadable versions now have their own `compatibleVersions` state.
- **Install** asks the backend to select the newest published version compatible with this server's Minecraft version, loader and dedicated-server support. This can include a beta/alpha if it is the newest compatible release. The grey **Versions** button opens a modal with all compatible artifacts, release channels and dates; each has its own Install button. There is no version dropdown. Explicit selections are checked again by the backend. Stop the server before installing. Modpacks still require their exact loader version and a fresh world.
- **Delete server** sits beside Archive, and is also available in Archive. It requires the exact server name and a stopped/idle server. It removes the server folder (including worlds), schedules, permissions assignments, analytics and notifications. Existing backup files and download history remain. Folder removal is journaled: database failures restore the original folder; locked files are retried at the next launch without blocking the WebGUI. Only use deletion when you intend to remove that world.
- **Stop stays stopped:** explicit Stop persists a manual-stop flag and prevents Minecraft pings from waking it, including after restarting MMSM or changing server settings. Start clears that flag. Sleep now clears it and puts a stopped server into sleep immediately (the sleep toggle must be enabled). Internal backup/restart stops do not change your preference. Kill also leaves the server stopped.
- Server sections are roomier and wrap naturally: **Overview, Console, Files, Properties, Players, Mods & Plugins, Backups & scheduling, Settings**. Role restrictions still hide unavailable sections.
- Stop is red, Restart yellow and Kill grey across headers/cards/lists. Dashboard server cards highlight on hover; clicking the image or unused card space opens the server. Keyboard focus + Enter/Space works too. Buttons inside cards retain their own actions.
- The main Overview starts with live statistics and **Your servers**, with Create server beside that heading. Introductory text and overview history panels are removed.
- The download popup keeps all active transfers and at most **three finished records**. **View all history** opens a paginated table showing item, source, time, server and destination. New records track the final installation destination when applicable; older records may lack path metadata. Dismissing an entry only hides it from the popup.
- Finished history is bounded by **10,000 records, 16 MiB of stored metadata and 90 days**, with oldest records removed when any limit is exceeded. Active transfers are never pruned. Cleanup runs at startup, after transfer completion, and hourly. It deletes metadata, never downloaded files. SQLite may reuse freed space instead of shrinking the database file immediately.
- Theme settings now include **Navbar** and **Hover / active navigation** colors. These affect the sidebar, top bar and navigation hover/selected states.
- Analytics replaces live cards with **7/30/90/365-day** graphs for combined player-hours and actual player-proxy bytes, plus per-server totals. Daily buckets are UTC. Player-hours are an estimate from sampled counts (two players for one hour = two player-hours), not a per-user session ledger. Unknown counts and manager downtime are not credited. Hourly aggregates retain 366 days independently of the raw CPU/RAM sample retention. New totals collect from 0.4 onward; historical activity is not fabricated or backfilled. Archived/unassigned servers are excluded.

## Earlier changes from 0.3


- Players: online names, cached UUIDs, Minecraft skin heads, whitelist and banned lists, operator status, whitelist/ban/op actions. Unknown names show a fallback if Mojang/skin requests fail. Online names come from join/leave logs; the numeric count comes from status queries, so unusual plugin log formats may affect the named list.
- Rejected whitelist joins create deduplicated requests with **Whitelist** / **Ignore** actions in Notifications. Running servers receive console commands; requests resolve after Minecraft logs successful addition or its whitelist file confirms it. Offline-mode UUIDs are computed locally when the server is stopped. Online-mode additions verify public Minecraft profiles. Ignoring suppresses repeat requests for that player/server.
- Notifications focus on newer stable Minecraft/loader releases, compatible mod updates and join requests. Installation progress stays in Downloads/server details. Update notices open the appropriate section; no runtime/world update is applied automatically. Checks run every six hours by default, with independent retries for loader and mod checks.
- Creation and runtime-update dialogs hide Minecraft snapshots/pre-releases and experimental loader builds unless **Show experimental versions** is checked.
- Server selection checkboxes on account creation/editing. All current servers start checked, with an **All servers, including future servers** option. Unchecking any server turns that option off. Restricted selections are explicit; assign newly created servers later. Legacy unrestricted accounts and the owner retain all-server access. Restricted admins manage assigned servers but cannot create servers, manage accounts or edit global settings. Roles still limit actions within assigned servers. Downloads, notifications, direct routes and historical totals respect the selection. Host totals remain whole-host measurements; unassigned workloads are grouped with “other”.
- **Restart** controls save/stop and launch a fresh process. **Backups & scheduling** supports named backup rules, destination paths, retention and interval jobs in seconds, minutes, hours, days or weeks. Scheduled actions: backup, start, stop, restart, sleep. Rules can be edited; schedules can be edited, paused or deleted.
- Backups save running worlds by gracefully stopping first, then ZIP the server directory and resume a previously running server. Sleep stays asleep. Retention removes only files recorded for that rule. Rule deletion does not delete existing backup files. No overlapping scheduled job per server. MMSM must remain open; overdue intervals coalesce to one run rather than replaying every missed interval. Archives never run schedules. Restoring is currently manual.
- Separate **Installed** and **Search Modrinth** tabs; missing IDs no longer falsely compare as installed. Malformed version data gets an explicit retry action instead of a blank dropdown and false Installed button.
- Server icons from `server-icon.png` appear on cards, lists and the compact server header. Upload in server Settings while stopped; MMSM center-crops/resizes to 64×64 PNG. Status symbols now distinguish online/asleep/crashed/stopped, with amber for transitions.
- Wrapper image and accent/background/panel colors in Settings. Account settings accepts an uploaded avatar or the face/hat from a Minecraft username. Upload controls accept PNG/JPEG/WebP up to 2 MB. Wrapper branding is shared; avatars are per account. Sidebar footer shows the installed MMSM version.

## Earlier changes retained from 0.2


- RAM settings and usage show **GB**, including fractional allocations. The conventional Minecraft conversion is 1 GB = 1024 MB; the existing `memory_mb` storage/API stays compatible.
- **Sleep now** beside the sleep settings saves the world and skips the idle timer. Enable and save sleep first, then use a Minecraft ping to test wake-up.
- **Stop** acts immediately without a confirmation prompt. **Kill process** is available in the server header, including while graceful stop is stuck, and warns before force-terminating the JVM without saving.
- Files can be uploaded to the current directory (multiple files, 512 MB each) or individually deleted. The server must be stopped. Deletions move files to `backups/<server-id>/<timestamp>-deleted-files/`; restore them manually while stopped. Folder deletion and overwriting existing upload filenames are intentionally not performed. Managed runtime/network files remain protected.
- Modrinth cards show project icons, a direct **Install** button and a compatible **Versions** modal. Search is paginated in 12-result pages and loads when you open Search Modrinth. Existing installed projects get icons without reinstallation.
- Installed-mod update badges refresh on the page, naming the compatible Minecraft version. Background checks use the configured interval (6 hours by default); failures retry after 15 minutes, and archived servers are skipped.
- Downloads and Notifications are top-right, click-away popups rather than sidebar pages. Downloads opens during an installation, closes when the automatic batch finishes, and retains history. Clicking the icon manually keeps the history open; completed entries can be dismissed individually or together for your account. Dismissing history does not delete downloaded server files or underlying download records.
- Username and role are at the top right. Click them for **Account settings**, including password changes and Sign out. The separate password/logout header buttons and “Connected to manager” badge are gone.
- The sidebar now has a **Servers** list containing all non-archived servers.

## Start in under a minute

Requires **Python 3.12 or newer**. MMSM automatically installs missing `psutil` (telemetry) and Pillow (images) into its project-local `dependencies` directory. Internet access and pip are needed for that first installation; no global Python packages are changed. Java is selected/downloaded automatically when you create a server; a preinstalled matching Java runtime is reused.

Extract this folder, open a terminal inside it, and run:

```bash
python3 -m mmsm
```

On Windows:

```powershell
py -3.12 -m mmsm
```

Open **http://127.0.0.1:11015**. Enter the one-time setup token printed in the terminal and create the owner account. The token prevents another network visitor from claiming an unconfigured installation. There is no public signup after the first owner exists.

If dependency setup fails, check pip/internet access and restart. A manual project-local retry on Windows is:

```powershell
py -3.12 -m pip install --target dependencies "psutil>=6,<8" "Pillow>=12,<14"
```

Use the same Python interpreter that launches MMSM. Linux has a `/proc` telemetry fallback. Missing measurements display as unavailable, never invented values.

To expose the WebGUI on your LAN:

```bash
python3 -m mmsm --host 0.0.0.0 --port 11015 --data ./data
```

The public Minecraft port defaults to 25565 per the creation form; choose a different port for each server. Minecraft proxies bind to all IPv4 interfaces by default. Forward only the desired Minecraft public ports through your router. The Minecraft process itself binds to a private loopback port chosen by MMSM.

Before creating a Paper server, put your own contact URL/email in **Settings → Upstream contact**. Paper’s download service requires it in the User-Agent header.

## Included features

| Area | Behavior |
|---|---|
| WebGUI | Built-in HTTP server; configurable port; responsive dark interface; no frontend build step |
| Accounts | First owner signup, admin-only account creation, admin/operator/viewer roles, password changes, session revocation, CSRF protection, rate limiting |
| Dashboard | Server cards, online players, CPU/RAM split between Minecraft and other processes, player traffic, host network totals |
| Server creation | Live Minecraft/loader catalogs for Vanilla, Fabric, Forge, NeoForge and Paper; stable releases by default; an experimental checkbox exposes other returned versions |
| Archive | Stops listening on public ports; blocks file access, starts, updates and configuration; excluded from current and aggregate historical stats; preserves files/history until unarchived |
| Modrinth | Search, choose versions, checksum-checked mod/plugin installation, required dependencies, enable/disable, compatible-update detection and notifications |
| Paper plugins | Paper, Spigot and Bukkit compatibility tags accepted; installed to `plugins/` |
| Modpacks | `.mrpack` downloads via Modrinth; exact game/loader compatibility checks; client-only files skipped; shared then server override layers applied |
| Server updates | Stopped-server updates, a full prior-runtime backup, preserved worlds/config/mods, rollback on installation failure |
| Downloads | Automatic top-right transfer popup, progress, retained history and per-account dismissal |
| Sleep | Idle timeout based on player status; public TCP listener wakes on a valid Minecraft status/login handshake |
| Properties | Property editor; network binding and status configuration remain manager-controlled |
| Files | Scoped browsing, uploads, backed-up file deletion, UTF-8 viewing and config editing; path traversal/symlinks blocked |
| Java | Minecraft metadata determines Java major; matching system runtime reused or verified Temurin JDK downloaded for the host OS/architecture |
| Settings | Web port, creation defaults, telemetry retention, update scan interval, contact identity, archive access and theme colors |
| Analytics | Five-second samples; per-server and combined charts; CPU, RAM, players and inbound/outbound proxy traffic; historical player-hours and traffic totals |

## Normal workflow

1. Set defaults, your upstream contact and your EULA auto-accept preference in Settings.
2. Create a server, pick the loader and versions, allocate memory, choose a unique public port, with global EULA acceptance enabled.
3. Watch Downloads and the server status while Java/loader installation runs. Installation errors are visible on the server and failed download entries.
4. Install mods/plugins from the server’s **Mods & plugins** tab while the server is stopped.
5. Start the server. It becomes “running” when a real Minecraft status query succeeds. Use Console for commands and output.
6. Use **Stop server** to save the world gracefully before updating, modifying files, changing settings, or archiving.

For a modpack, first create a fresh server using the pack’s exact Minecraft and loader version. Then search Modrinth with the Modpacks type and install its version. A mismatch fails with an explanation; MMSM never silently switches your existing world’s loader. Pack-level upgrades are not implemented: individual matched jars can be updated, but doing so may diverge from the pack author’s tested combination.

## Operating details and limits

- **Sleep is wake-and-reconnect, not seamless login queuing.** The first ping returns a starting message while boot runs in the background. Reconnect after boot. A server-list auto-refresh is a ping and can keep waking a server. An unavailable player count never counts as zero.
- **This is a TCP proxy.** Minecraft sees the loopback proxy as each player’s source IP. Online-mode player authentication still works, but IP bans, IP-based plugins and per-IP limits need consideration. PROXY protocol, Bedrock/Geyser UDP, UDP Query, RCON forwarding and voice-chat UDP are not implemented.
- **Telemetry is defined, not guessed.** CPU is normalized to whole-machine capacity. Minecraft RAM is JVM process RSS, so the difference from total used RAM is an approximation and includes MMSM/OS/cache/other processes. Child processes started by plugins are not attributed to their parent JVM. Player traffic is measured at the public TCP proxy; plugin web requests and downloads are not included in that number. Host network counters include other services. In containers, host measurements reflect the visible OS counters, not cgroup quotas.
- **Archives are logical.** Files remain under `Servers/<server name>/`; the archive flag gates all server activity. Historical rows remain until the retention window expires, but aggregate queries exclude archived IDs.
- **Port changes require an MMSM restart.** The setting is persisted immediately, but the listener is not silently re-bound. Use `--port` only for an intentional override; it also saves that port.
- **Modpack support is intentionally bounded.** Allowed pack roots are `mods`, `config`, `defaultconfigs`, `kubejs`, `scripts`, `resourcepacks`, `datapacks` (plus `options.txt` in overrides). Executable/launch/network overrides are rejected. Downloads are restricted to approved official/CDN hosts. Unmatched jars remain installed but do not get Modrinth update tracking; their count is reported. Locally added jars are visible in Files but are not automatically imported into the Modrinth tracker.
- **Automatic dependency resolution is not a full dependency solver.** Required dependencies are installed; conflicts are rejected. Optional dependencies are not installed automatically. Disabling a required dependency can prevent a server from booting.
- **Loader support has practical version boundaries.** Forge jar launches and modern argument-file launches are supported. The NeoForge catalog uses its `net.neoforged:neoforge` artifact (Minecraft 1.20.2 onward); legacy NeoForge 1.20.1 under the older Forge artifact is not supported. Quilt, Purpur, Folia and custom loaders are not included in this preview.
- **No destructive world downgrades are performed automatically.** You choose updates explicitly. Check the target loader’s mod compatibility first. Safety copies made by runtime/mod updates remain separate from scheduled backup-rule ZIPs and are not automatically pruned. Backup-rule ZIP retention is configurable.
- **No automatic force-kill.** Graceful stop waits 45 seconds, then reports a timeout. The explicit Kill process button can interrupt a stuck stop; it does not save the world. A hard manager crash can leave a JVM running; use the supplied systemd unit to keep process ownership under service supervision.
- **Download limits:** 2 GiB per artifact, 4 GiB extracted Java/ZIP archives, 5,000 pack files, 2 MiB text viewer/editor. The popup shows three finished transfers plus active downloads. Full history is paginated and bounded as described above. These bounds may reject unusually large packs.
- One installation manages local server processes. Multi-host agents, two-factor authentication, calendar/cron schedules, in-app backup restoration and automatic pack upgrades are outside this version.

## Data and recovery

Default state stays inside the project folder (beside `start.bat`):

```text
Servers/<server name>/  Jar/libraries, worlds, mods, plugins, properties, player lists, server-icon.png
data/mmsm.sqlite3       Accounts, sessions, server records, settings, notifications, schedules, metrics and usage aggregates
data/backups/<id>/     Automatic pre-update and deleted-file recovery copies
data/java/<major>/     Managed Java distributions
data/downloads/        Java archives and downloaded packs
data/images/           Wrapper logo, account avatars and cached Minecraft faces
Backups/<server name>/ Default backup-rule ZIP destination
dependencies/          Project-local psutil and Pillow (when needed)
```

A custom `--data` argument or backup-rule destination is an explicit exception to these defaults. Never share one `Servers` folder between independently running MMSM installations. Server files are rooted in the program directory even when `--data` points elsewhere.

To back up the whole installation, stop Minecraft and MMSM, then copy the entire project directory plus any custom data/backup paths. Do not copy only SQLite while the service is running in WAL mode. Back up `Servers` as well as `data` after upgrading.

To restore a backup-rule ZIP: stop the server, preserve its current folder, then extract the ZIP into the appropriate `Servers/<server name>` folder. Use a matching runtime/loader version. A ZIP contains the server's files, not account/settings metadata. For full manager/runtime rollback, restore a matching whole-installation backup including SQLite. There is no restore button in this preview.

## Deployment

Run MMSM as a dedicated unprivileged OS account. Minecraft mods and plugins execute code with that account’s permissions; only trusted administrators should install them or edit server files.

The default listener is now all IPv4 interfaces. For HTTPS administration, save the public origin in Settings, or use explicit command-line overrides (localhost is suitable only when the proxy can reach that same network namespace):

```bash
python3 -m mmsm --host 127.0.0.1 --origin https://mmsm.example.com --data ./data
```

Preserve the original Host header and proxy HTTP to `127.0.0.1:11015`. HTTPS-origin logins get Secure session cookies; direct HTTP logins use a separate non-Secure cookie. Do not expose the unencrypted admin port directly to the Internet. Public DNS hostnames must match the saved Public URL or `--origin`; direct public-IP and private-IP LAN access validate their own HTTP origin even when a Public URL is configured.

See `deploy/mmsm.service` for a Linux systemd unit, and `Dockerfile` / `compose.yaml` for a Linux host-network container option. Adapt paths before installing the unit and make `/opt/mmsm` writable by its dedicated service account. Containers now persist `/app/data`, `/app/Servers`, `/app/Backups` and `/app/dependencies` in separate volumes. If upgrading an older container, preserve its old data volume and change the mount to `/app/data` before starting; do not discard the original volume. The supplied container configuration is for Linux Docker; use native Python on Windows/macOS or configure explicit Docker port mappings yourself.

## Tests

```bash
python3 -m unittest discover -s tests -v
```

The suite has HTTP auth/role tests, archival and history checks, real TCP proxy tests, provider contracts, checksum/rollback tests, Modrinth dependency/plugin/mrpack fixtures and a real JVM protocol fixture. A Java compiler (`javac` or the `jdk.compiler` module) is needed for the JVM fixture; without it the JVM tests are skipped. It is not a Minecraft jar and must not be mistaken for upstream integration proof.

```bash
node --check mmsm/static/app.js
```

The UI behavior tests can also be run without a browser:

```bash
node --test tests/ui.test.cjs
```

Node is only needed for these development checks, not for running MMSM. The UI tests execute the real UI functions and event handlers with a minimal DOM harness; they do not verify CSS layout or actual browser rendering.

See [VERIFICATION.md](docs/VERIFICATION.md) for the host smoke-test checklist before using important worlds.

### Automatic Cloudflare DNS (0.8.1)

In wrapper Settings, configure the DNS zone, base domain and public entry-point IP. To automate publishing, supply your Cloudflare Zone ID and a scoped API token with Zone Read and DNS Edit permissions for that zone, then enable automatic Minecraft DNS management. The token is stored in the host database; the settings API never returns it. Use HTTPS for public account/settings access and protect host data/backups.

New-server creation shows an editable subdomain before the fixed base domain. Edit existing addresses in the server Public address tab; the full hostname also appears on server headers and dashboard cards. Saving an address publishes its A/AAAA, CNAME and Java SRV records. MMSM retries every five minutes and shows publication status. Existing DNS records are not adopted or overwritten: remove conflicting records manually if you want MMSM to own those names. Renaming/clearing an address removes owned CNAME/SRV records; shared base records remain. Turning automation off, archiving or deleting a server leaves its DNS records in place. Clear its address before deletion if you want automatic record removal. IP changes require editing the public entry-point IP setting; this is not IP discovery or a tunnel.

No NS delegation is needed for Cloudflare API mode. Hosting an authoritative DNS service with delegated NS records is a separate deployment requiring public DNS reachability on TCP/UDP 53. DNS names do not replace Minecraft TCP port forwarding; each separate server needs a distinct external port unless a Minecraft-aware proxy routes connections.

### Update channels

Stable (the default) follows published releases. Experimental follows the latest verified push on main or the experimental branch, through a separate prerelease build feed. Choose a channel in wrapper Settings, save, then Check for updates. New pushes with the same version number are detected using their commit ID. Installing stays manual and requires stopped Minecraft servers. Switching back to Stable offers the latest stable package, including when returning from a newer experimental version. Custom stable feeds remain supported. Experimental uses the official feed. The newest three experimental ZIPs are retained.

Ordinary pushes publish experimental builds after tests pass, and never publish stable releases. Stable publication requires explicit owner authorization and a changed release-request.json matching the program version. For this 0.8.1 release, the owner explicitly requested publication; future pushes must not change that release marker unless the owner requests another release.

The browser tab icon uses the saved launcher image, with the top-left cube as default. Uploading a new logo refreshes it immediately in that browser; other signed-in tabs refresh branding within 30 seconds.

### Experimental changes after 0.8.1

Wrapper Settings is now a gear beside the version number at the bottom of the sidebar (also accessible in the compact mobile layout). It retains global administrator access restrictions. Usernames preserve their typed capitalization, while login and duplicate-name detection are case-insensitive; passwords remain case-sensitive. Existing account capitalization is unchanged.


UNM DNS records owned by MMSM are removed when their server is permanently deleted.
If UNM is unavailable, cleanup is saved locally and retried every five minutes while
MMSM runs, including after restart. Keep the original UNM endpoint, zone and a valid
integration token configured until cleanup completes. Archiving retains DNS records;
port forwarding is managed separately in UNM.
