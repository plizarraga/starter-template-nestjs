# 08 — Apply Redis-backed rate limits

**What to build:** Public authentication endpoints resist repeated abuse consistently across application replicas without weakening authentication failure behavior.

**Blocked by:** 05 — Implement refresh and session revocation.

**Status:** ready-for-agent

- [ ] Registration, login, and refresh enforce their configured per-IP limits through Redis-backed counters.
- [ ] Exceeded limits return the standard 429 RATE_LIMIT_EXCEEDED contract.
- [ ] Limit configuration is validated and endpoint behavior is covered by automated tests.
