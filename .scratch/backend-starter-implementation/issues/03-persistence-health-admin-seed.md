# 03 — Add persistence, health, and admin seed

**What to build:** The starter manages durable users in PostgreSQL, accesses Redis through a platform boundary, reports dependency readiness safely, and can explicitly provision an administrator.

**Blocked by:** 02 — Build HTTP platform foundation.

**Status:** ready-for-agent

- [ ] The user data model persists normalized unique emails, roles, timestamps, and non-public password hashes through committed Prisma migrations.
- [ ] PostgreSQL and Redis are available through encapsulated platform services, with safe failure mapping for operations that require them.
- [ ] Liveness and readiness endpoints distinguish process health from required dependency health without exposing internals.
- [ ] An idempotent explicit admin seed creates or promotes the configured account without running during API startup.
