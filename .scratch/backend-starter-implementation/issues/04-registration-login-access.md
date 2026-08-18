# 04 — Enable registration, login, and access authentication

**What to build:** A client can register a normal user, log in with valid credentials, and use a short-lived access token for protected requests without a user or session-store lookup on that path.

**Blocked by:** 03 — Add persistence, health, and admin seed.

**Status:** completed

- [x] Registration validates and normalizes email, hashes passwords asynchronously with the configured scrypt policy, always assigns USER, and rejects duplicate email safely.
- [x] Login returns indistinguishable failures for unknown users and invalid passwords, creates an independent Redis-backed session, and emits safe security events.
- [x] Issued HS256 access tokens enforce issuer, audience, expiration, and produce principals limited to identity and role without PostgreSQL or Redis queries.
