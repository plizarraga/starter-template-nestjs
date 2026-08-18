# 05 — Implement refresh and session revocation

**What to build:** A logged-in browser can renew its access credential with a rotating opaque refresh cookie and can revoke either the current session or all of its sessions safely.

**Blocked by:** 04 — Enable registration, login, and access authentication.

**Status:** completed

- [x] Refresh credentials are stored only as HMAC-protected secrets in expiring Redis sessions and are transported with secure cookie defaults.
- [x] Refresh rotation is atomic: one use succeeds, prior credentials cannot be reused, and concurrent consumption yields exactly one success.
- [x] Refresh and logout endpoints validate allowed origins, fail closed when Redis is unavailable, and logout clears the browser cookie while remaining idempotent where practical.
- [x] Logout-all requires a valid access credential and revokes all indexed sessions for its principal.
