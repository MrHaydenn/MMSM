# MMSM 0.8.1

- Browser tab icon follows the wrapper logo; the default cube is used until a logo is uploaded.
- Stable/Experimental update channels: experimental builds track verified pushes by commit, with the same checksum and transactional installation checks.
- Server creation includes a subdomain input beside a fixed base domain; addresses remain editable per server and visible on cards and headers.
- Optional Cloudflare DNS publishing with scoped credentials, ownership checks, rename/clear cleanup, status and five-minute retries.
- Tokens are write-only through the settings API. Existing records are never overwritten.
- Documentation distinguishes DNS publishing from NS delegation and port forwarding.

# MMSM 0.8.0

- Duplicate public-port override with a warning and exclusive listener ownership.
- One-way server folder and loader-version syncs, backups, and confirmation before manual edits disconnect a sync.
- Public Minecraft address management with Cloudflare-compatible DNS record instructions.
- Official GitHub update feed enabled by default for fresh installations.

Sync changes wait for both servers to stop. Domain records require manual DNS setup and appropriate TCP forwarding. See README for limits and recovery details.
