# 10 — Verify security invariants end to end

**What to build:** The completed starter has automated proof that its public API, failure behavior, logging, and authentication lifecycle uphold the product security invariants.

**Blocked by:** 06 — Add self profile and password management; 07 — Enable administrative user management; 08 — Apply Redis-backed rate limits; 09 — Prepare reproducible production delivery.

**Status:** ready-for-agent

- [ ] Integration and E2E suites cover authentication, refresh rotation and reuse, concurrent refresh, logout, logout-all, password change, RBAC, pagination, search, and sorting.
- [ ] E2E assertions cover standardized 400, 401, 403, 404, 409, and practical 500 error responses, including request ID propagation.
- [ ] Tests demonstrate that sensitive credentials and infrastructure details do not appear in logs or error responses, and record evidence for invariants S1 through S16.
