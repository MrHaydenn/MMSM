# Experimental sidebar change after 0.8.1

134 Python tests and 50 JavaScript behavior tests passed, with zero skips. Compilation and JavaScript syntax checks passed. A registration/session integration test verifies preserved username capitalization, mixed-case sign-in, duplicate rejection and case-sensitive passwords. UI checks verify the footer gear placement, active state and global-admin visibility restrictions. Mobile footer visibility is retained in CSS; rendered-browser layout is unverified. This push does not change the stable release request.

---

# MMSM 0.8.1 browser branding and update channels

133 Python tests and 49 JavaScript behavior tests passed, with zero skips. Python compilation and JavaScript syntax checks passed. New tests cover public favicon default/upload/replacement, revision refresh, channel validation, experimental commit identity, stable fallback, checksum and package channel/revision stamping. The experimental and stable publication workflows repeat tests and verify their live manifests/downloads through the real updater. Browser layout and live Cloudflare changes remain unverified.

The owner explicitly authorized this stable release. Future ordinary pushes publish experimental builds only; stable publication requires a new explicit request (see AGENTS.md).

---

# Verification record — MMSM 0.8.1

The 126-test full Python suite passed; after final validation changes, all six focused DNS tests passed (the combined suite now contains 127 tests). All 48 JavaScript behavior tests, Python compilation and JavaScript syntax checks passed. Zero skips.

New tests cover server-creation hostname/port validation, Cloudflare record creation, repeated reconciliation without unnecessary writes, external-port updates, rename/clear cleanup, conflicts without overwriting unowned DNS, wrong-zone rejection, retry and disabled/archive dormancy. HTTP tests verify write-only tokens, retained tokens on blank input and incomplete-settings rejection. UI tests verify the fixed base input, opt-in settings and card hostname display.

Cloudflare API responses were simulated. No user token was available, no live DNS records were changed, and authoritative DNS propagation/port forwarding were not tested. UI tests use a minimal DOM harness, not rendered-browser layout. Automatic Cloudflare mode implements API publishing, not an authoritative DNS server or tunnel. This version is prepared in source, not published as a release.

---

# Verification record — MMSM 0.8.0

121 Python tests and 47 JavaScript behavior tests passed locally, zero skips. Python compilation and JavaScript syntax checks passed.

New coverage: duplicate public-port creation with explicit override, rejection of backend-port conflicts, real socket listener handoff and refusal while another server is active; one-way folder replacement/deletions, backup retention, manual unlink guards, out-of-band destination edits, running/archived pauses, symlinks and protected paths, chained rules and loader mismatch, mocked runtime-provider handoff and mod registry/disabled JAR propagation, failed copies preserving destination files; HTTP edit-confirmation and scoped-source permissions; fresh-install release feed; generated DNS records and hostname validation; UI confirmation/retry/cancel behavior and escaped sync/address controls.

Limits: live Minecraft distributions were not booted for these features, and runtime sync provider installation is mocked in its focused test. Existing loader and process tests remain in the suite. Browser tests use the minimal DOM harness, not visual rendering. DNS generation makes no external changes; no Cloudflare account, authoritative DNS propagation, router forwarding or Windows-host networking was tested. Automatic sync waits for both servers to stop. Runtime installation commits separately from folder replacement and keeps its existing runtime backup if a later folder operation fails.

The owner approved publication of 0.8.0. GitHub repeats the suite before publishing the release assets.

---

# Verification record — MMSM 0.7.4

113 Python tests and 44 JavaScript behavior tests passed locally, with zero skips. Python compilation and JavaScript syntax checks passed.

New tests verify the official GitHub default feed, update notification, one-time blank-feed migration, preserved custom feeds and preserved opt-out. Separately, the unchanged 0.7.3 updater was loaded from the previous distribution and successfully checked and staged the actual newly built 0.7.4 update ZIP using a local transport fixture. This validates old-client manifest, checksum and package compatibility. Existing tests cover transactional install, restart, account preservation and rollback.

GitHub Actions repeats the suite before publishing the assets. Local tests do not exercise the user's Windows host or public proxy. Live release verification is separate from the local fixture check.

---

# Verification record — MMSM 0.7.3

Build date: 2026-10-07. Linux / Python 3.12 / Java 17 / Node 24.

**111 Python tests and 44 JavaScript behavior tests passed, zero skips.** Python compilation and JavaScript syntax checks passed.

Reproduced Python SimpleCookie losing the session cookie when a preceding unrelated parent-domain cookie contains raw JSON, matching the format visible in the reported screenshot. New parser tests cover unrelated JSON, malformed cookies before/after the session, quoted session values, invalid tokens and duplicate names (including across header fields). A local HTTP integration test simulates HTTPS proxy headers and exercises login, authenticated /me, saving the public URL, password changes, session revocation and logout with an unrelated JSON cookie present. Wrong CSRF tokens and unrelated origins still fail.

This validates the application parsing fix locally. It does not claim an end-to-end test through the user's domain/proxy, a browser cookie jar, or Windows start.bat. Existing test boundaries below continue to apply.

---

# Verification record — MMSM 0.7.2

Build date: 2026-10-07. Linux / Python 3.12 / Java 17 / Node 24.

**108 Python integration tests and 44 JavaScript behavior tests passed, zero skips.** Python compilation and JavaScript syntax checks passed.

New HTTP cases reproduce the account issue with an HTTPS Public URL configured and direct HTTP public-IP/localhost request headers. They verify login cookie attributes, authenticated reads, correct-password changes, invalidation of previous sessions, rejection of the previous password, new-password login, logout cookie expiry and server-side revocation. Separate checks exercise HTTPS Secure cookies and logout, normalized default ports, rejection of unrelated origins/wrong origin ports/unknown hostnames, continued CSRF enforcement and stale legacy-cookie handling. UI coverage verifies sign-out closes the account dialog and clears local state for active or expired sessions.

Port tests verify default 11015, one-time migration of saved 3000, preservation of custom ports and preservation of explicit later choices. Public-IP/proxy scenarios use HTTP headers against the local test server; these are not claims of end-to-end connectivity through the user's public network. Native Windows execution, browser cookie-jar behavior and visual rendering remain host checks.

---

# Verification record — MMSM 0.7.1

Build date: 2026-10-07. Linux / Python 3.12 / Java 17 / Node 24.

102 Python integration tests and 43 JavaScript behavior tests passed, zero skips. Python compilation and JavaScript syntax passed.

New checks cover all-interface defaults, public-IP Host acceptance, same-origin access, continued arbitrary-DNS/cross-site rejection, persistence of listener/public-origin settings, explicit overrides, input normalization/validation and Secure cookies for HTTPS proxy login. The existing real-process entrypoint/update/restart test now verifies that normal startup actually binds to `0.0.0.0` after restart.

No test connected through the user's actual router, public IP, firewall or proxy. Windows batch execution and visual browser rendering remain host checks. No TLS certificate or network forwarding was provisioned by this update.

---

# Verification record — MMSM 0.7.0

Build date: 2026-10-07. Linux / Python 3.12 / Java 17 / Node 24.

- **99 Python integration tests passed**, zero skips.
- **43 JavaScript behavior tests passed** against actual UI functions and event handlers in the minimal DOM harness.
- Python compilation and JavaScript syntax passed.
- New cases cover local JAR upload/registration, enabled/disabled file transitions, zero Modrinth provider calls for local entries, Paper plugin paths, invalid containers/extensions/traversal/case-insensitive collisions, live/archived/Vanilla rejection, database-failure file rollback, authenticated upload routing and administrator/CSRF restrictions.
- Existing dependency-install test now verifies persisted parent-to-library relationships. Backfill tests verify relationships come from the currently installed version and ignore optional dependencies. UI cases verify source labels, direct dependency notes, absence of Modrinth actions on local entries, switch requests and error restoration.

No arbitrary uploaded JAR code was executed. This release uses fixture JARs and Modrinth responses for these new cases; it did not add a live Modrinth network test. Visual browser layout/native file picking and Windows execution remain unverified here. Local JAR compatibility and dependency inference are intentionally not claimed.

---

# Verification record — MMSM 0.6.0

Build date: 2026-10-07. Linux / Python 3.12 / Java 17 / Node 24.

- 94 Python integration tests passed with zero skips.
- 41 JavaScript behavior tests passed against actual UI functions/event handlers in the minimal DOM harness.
- Python compilation, JavaScript syntax, and release-builder smoke checks passed.
- A separate real MMSM subprocess ran through the normal entry point, installed a test release, replaced/re-executed itself and returned the new version while preserving the existing login session/account. Release HTTP responses and dependency bootstrap were fixtures; no release was published or fetched from a real update host.
- Update tests cover polling interval/preference, deduplicated notices, no-feed/current/malformed-feed states, SHA-256 rejection, unsafe/protected paths, incomplete packages, version mismatch, private hosts, busy-operation gates, failed replacement rollback, interrupted transaction recovery and preservation of data/worlds. HTTP tests exercise administrator restrictions, themes and Vanilla creation/install compatibility.
- UI tests cover fixed navigation/removal of drag code, compact icon-bearing status badge, upper-left Back, hidden/restored Vanilla loader-build field, inline Search order, theme choices and update buttons.

Windows execution, visual browser layout, native clipboard/file pickers, and a real public release-host round trip are not verified here. Actual Minecraft distributions were not booted; earlier Java lifecycle tests use the protocol fixture. File-transaction rollback is tested; arbitrary future release bugs cannot be guaranteed to roll back automatically. Publishing and host setup are explained in RELEASING.md.

---

# Verification record — MMSM 0.5.0

Build date: 2026-10-07. Linux, Python 3.12, OpenJDK 17, Node 24.

- **82 Python integration tests passed, zero skips.**
- **37 JavaScript behavior tests passed** using the actual UI functions and event handlers in a minimal DOM harness.
- Python compilation and JavaScript syntax checks passed.
- A live Modrinth `downloads`-sorted Fabric API search for Minecraft 1.21.1 returned Fabric API, Indium and Platform in descending download count. See `live-modrinth-sort.json`. No new mod code was executed.

New regression coverage includes real JVM startup failure (exit 7 with captured output), unexpected running-process termination, intentional stop classification, persisted crash state/report, missing Java, queued idle-sleep cancellation after Stop, queued restart/AutoStart cancellation, scheduled restart pause, and Stop issued on a separate thread while backup files are locked. Folder deletion tests cover recovery copies, mod metadata, protected descendants, symlinks and root/path escapes. HTTP tests cover account-specific navigation preferences, validation and operator-only crash logs. UI tests cover filtering, scroll preservation, installed-version selection without prior search, clipboard fallback, folder actions, sort/plugin options, status markup and saved navigation reorder.

These are actual executed tests, but the Java server is a protocol fixture, not a Minecraft distribution. Browser rendering and Windows execution are **not verified**. Native drag behavior, icons/colors/spacing and clipboard integration should be checked in your browser. UI automation here covers event logic/markup rather than rendered layout. Long-running schedules and host boot integration remain host checks.

## Suggested host checks for 0.5

1. Preserve `data`, `Servers`, `Backups` and `dependencies` when replacing program files. Restart MMSM and hard-refresh the browser.
2. On a disposable server, check a failed launch shows Crashed and Copy error logs captures the console. Confirm Sleep shows a blue moon and a manually stopped server stays offline when pinged.
3. Check AutoStart on one stopped test server, save, restart MMSM and confirm only selected active servers launch.
4. Test folder deletion/recovery, property filtering without losing values, auto-scroll off while reading old output, and the status bar from Settings.
5. Open an installed project's Change version before searching. Check Modrinth links, plugin compatibility, sorting and sidebar drag reorder across sign-outs.
6. Explicitly saved EULA choices are preserved; fresh/unset settings now default on. Change the wrapper checkbox if needed.

---

# Earlier verification — MMSM 0.4.0

Build date: 2026-10-07. Environment: Linux, Python 3.12, OpenJDK 17, Node 24.

## Verified

- **70 Python integration tests**, including earlier versions' tests, passed with zero skips.
- **30 JavaScript behavior tests** passed using the real frontend functions/event handlers in a minimal DOM harness.
- Python compilation and JavaScript syntax passed.
- **Live Modrinth check passed:** Fabric API for Minecraft 1.21.1 returned 36 compatible versions. The latest selected version was `0.116.17+1.21.1` (`Mys3P7lK`). MMSM downloaded its 2,452,735-byte JAR, verified upstream checksums, installed it into a temporary test server's mods directory, and verified the archive. No Minecraft process or that mod's code was executed in this check. See `live-modrinth.json`.

The live search response confirmed the bug: its `versions` entries are strings identifying Minecraft releases. They are not downloadable mod-version objects. A regression fixture now includes that field and verifies that MMSM still loads proper version details, shows Install and Versions, and never builds the old dropdown.

| Area | Checks |
|---|---|
| Modrinth latest install | Backend orders by publication time, filters Minecraft/loader/server support, selects latest, rejects incompatible explicit versions and rejects client-only projects |
| Versions modal | UI renders labels/channels/dates, submits the chosen version and closes after queuing; malformed details do not produce false Installed states |
| Deletion | Exact-name confirmation; refuses running/busy servers; authorization/scoping; keeps backups/unrelated files; removes metadata; database rollback preserves worlds; startup journal recovery and locked-file handling |
| Stop / sleep | Explicit stop blocks actual Minecraft status pings, survives manager recreation and settings changes; Sleep now re-arms wake; stale queued pings cannot undo a later Stop; a real JVM start clears manual stop |
| Download history | Popup active + three finished; paginated full history; source/destination/final-location metadata; record/byte/age limits; active transfers preserved; per-account dismissal and scope filtering |
| Analytics | Sampled player-hours, capped sample duration, unknown-count handling, exact proxy-byte deltas, 30 daily buckets, archive and server-scope exclusions |
| Layout / theme behavior | Stats-first Overview, clickable cards and keyboard navigation, nested control isolation, requested tab order, control-color classes, navbar/hover settings served in generated CSS |
| Earlier features | Account permissions, setup/session security, server-folder migration, EULA preference, backup ZIP/retention/schedules, images, players/whitelist, modpacks/dependencies, runtime update rollback, real sockets/JVM sleep/kill/restart |

Full test transcripts: `test-results.txt`, `ui-test-results.txt`.

## Remaining validation limits

No real Minecraft distribution was booted for this release; the process tests use the clearly named `TestServer.java` fixture. The user previously confirmed real server creation on Windows, but that is separate evidence. The live Modrinth check covers one representative Fabric mod; other loaders, plugins, modpacks and dependencies are fixture-tested, not all live-tested.

There was no accessible browser rendering environment. Native dropdown/modal rendering, layout, file pickers and hover appearance have not been visually verified. The UI tests exercise markup and actions, not browser layout. Windows, Docker/systemd execution and a long-running schedule/analytics soak test remain host checks.

## Host acceptance

1. Stop Minecraft and MMSM; back up your existing installation. Replace program files while preserving `data`, `Servers`, `Backups` and `dependencies`. Start with `start.bat --port 3000` and hard-refresh the browser.
2. On a stopped test server, search Fabric API or another compatible server mod. Install should work without choosing a dropdown. Open Versions and install a specific compatible version. A client-only project should produce a clear compatibility error.
3. With sleep enabled, Start then Stop. Ping from Minecraft: it must remain stopped. Restart MMSM and repeat. Click Sleep now while offline: the next ping should wake it. Start also re-enables idle sleep.
4. Verify card clicks, button colors, tab order/spacing and navbar/hover customization at your display width.
5. Download several mods. Confirm active progress remains visible, at most three completed items remain in the popup, and full history shows destinations/timestamps with pagination.
6. Let player activity run on disposable worlds; check historical player-hours and traffic graphs. New aggregate charts collect going forward, so earlier weeks are initially empty.
7. Delete only a disposable stopped server: a wrong name must fail; the correct name removes that server, while backup files and other servers remain.

## References used

- Modrinth version API: https://docs.modrinth.com/api/operations/getprojectversions/
- Modrinth search API: https://docs.modrinth.com/api/operations/searchprojects/

Documentation review is separate from the live download and offline test evidence above.

## Granular account permissions (experimental)

The permissions update preserves legacy role defaults and adds account creation grants, creator ownership, default capabilities and per-server overrides. HTTP regression tests cover denied read/write operations, hidden server access, raw uploads, ownership spoofing, session revocation, backup scheduling/path restrictions, and template/sync source access. JavaScript behavior tests cover permitted controls, denied forms/tabs and account-policy serialization. The full current suite contains 157 Python tests and 57 UI behavior tests; Python compilation and JavaScript syntax checks are also required before publication.

The account editor's browser layout has not been visually verified. Host acceptance: create a viewer with creation enabled and no existing server access; confirm its own server is fully controllable. Grant console viewing without commands, backup viewing without management, then one server-specific editing permission. Verify the affected account is signed out on save and sees only granted controls after signing back in.

## Idle sleep and independent sync settings

161 Python tests and 58 UI behavior tests cover this update. A real JVM fixture is checked at 299 and 300 simulated seconds: it stays online before the five-minute boundary, then gracefully stops, writes its world-save marker and enters sleeping state. This exercises the real status socket and stop process with a controlled clock; it does not boot the user's modded Minecraft servers. Regression tests cover players joining, status-query failures, manual-stop suppression, independent settings with legacy sync rules, selected-folder edit confirmation, other-file edits, and optional runtime/mod guards. Python compilation and JavaScript syntax checks are required.

On the host, set each stopped server's local idle time to five minutes, save, Start, disconnect players and watch the sleep countdown. Leave the Minecraft server list closed to avoid immediately waking it after sleep. If player queries fail, the UI now displays that reason rather than silently appearing to ignore the timer. Folder changes remain checked every 30 seconds and require both source and destination to be stopped.

## Automatic wake history

Wake tracking is covered by a real loopback proxy/status exchange, burst deduplication, cancellation and bounded persistent history tests, plus HTML escaping tests. Only accepted automatic wake requests are recorded; already-online pings do not create history. The build requires the full Python/UI suites and syntax checks. The history reports the transport peer and protocol intent, not a player's identity or proof of scanning.

## Join-only automatic waking

The real proxy tests now assert repeated status requests leave the server asleep with no wake history or queued start, then join handshakes queue exactly one start and return the reconnect message. The JVM lifecycle test verifies status leaves its sleeping process offline and a join starts it again. Full Python/UI suites, syntax checks and published updater verification are required.
