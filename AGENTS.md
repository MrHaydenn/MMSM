# MMSM publication policy

The owner requested a full stable release of 0.9.0 on 2026-10-10, with generic network examples and start.bat as the distributed launcher.

For future work, ordinary pushes must not publish stable releases. Do not change release-request.json or invoke the stable release workflow unless the owner explicitly requests a release in the conversation. The Stable channel must continue to follow published stable releases only.

Experimental builds are opt-in in MMSM Settings. Verified pushes to main or experimental may update the separate experimental prerelease build feed automatically. Those builds must never become GitHub's latest stable release.

Run the Python suite, JavaScript behavior tests and syntax checks before publication. Verify published update manifests, packages and commit stamps through the real updater after publishing.
