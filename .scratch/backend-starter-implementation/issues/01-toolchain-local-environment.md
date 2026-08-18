# 01 — Prepare toolchain and local environment

**What to build:** Developers can install, test, and run the starter locally with the intended test stack and isolated PostgreSQL and Redis dependencies.

**Blocked by:** None — can start immediately.

**Status:** completed

- [x] pnpm commands work after approving the required build script, and the lockfile remains reproducible.
- [x] Vitest provides separate unit, integration, and E2E projects with V8 coverage; integration and E2E suites can use Testcontainers.
- [x] Docker Compose supplies only local PostgreSQL and Redis dependencies with documented connection settings.
