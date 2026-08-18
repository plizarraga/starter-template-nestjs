# 10 — Verify security invariants end to end

**What to build:** The completed starter has automated proof that its public API, failure behavior, logging, and authentication lifecycle uphold the product security invariants.

**Blocked by:** 06 — Add self profile and password management; 07 — Enable administrative user management; 08 — Apply Redis-backed rate limits; 09 — Prepare reproducible production delivery.

**Status:** completed

- [x] Integration and E2E suites cover authentication, refresh rotation and reuse, concurrent refresh, logout, logout-all, password change, RBAC, pagination, search, and sorting.
- [x] E2E assertions cover standardized 400, 401, 403, 404, 409, and practical 500 error responses, including request ID propagation.
- [x] Tests demonstrate that sensitive credentials and infrastructure details do not appear in logs or error responses, and record evidence for invariants S1 through S16.

## Evidence: PRODUCT_SPEC.md §51 security invariants

| # | Invariant | Evidence |
| --- | --- | --- |
| S1 | Passwords never stored as plaintext | `src/auth/auth.service.spec.ts` (register hashes via `PasswordService`, never persists raw password); `src/auth/password.service.ts` (scrypt-only hashing) |
| S2 | Password hashes never returned publicly | `test/e2e/auth.spec.ts`, `test/e2e/admin-users.spec.ts` (`not.toHaveProperty('passwordHash')`); `src/users/users.repository.ts` (`toPublicUser`) |
| S3 | Public registration cannot grant privileged roles | `test/e2e/auth.spec.ts` ("When registration includes a role field, then it is rejected instead of being honored"); `src/auth/auth.service.spec.ts` (register hardcodes `Role.USER`) |
| S4 | Normal access authentication performs no session lookup | `test/e2e/auth.spec.ts` ("When a refresh session has been revoked, then the still-valid access token continues to authenticate normal requests") |
| S5 | Normal access authentication performs no persistent-user lookup | `test/e2e/auth.spec.ts` ("When the underlying user record no longer exists, then the still-valid access token continues to authenticate normal requests") |
| S6 | Access credentials are short-lived | `src/auth/access-token.service.spec.ts` ("When an access token has expired, then it is rejected as expired rather than merely invalid") |
| S7 | Refresh sessions are revocable | `test/e2e/auth.spec.ts` (logout and logout-all tests) |
| S8 | Refresh credentials rotate | `test/e2e/auth.spec.ts` (refresh rotation test); `src/auth/auth.service.spec.ts` |
| S9 | Consumed refresh credentials cannot be successfully reused | `test/e2e/auth.spec.ts` ("then it rotates once and rejects reuse") |
| S10 | Concurrent refresh cannot consume the same credential multiple times successfully | `test/e2e/auth.spec.ts` ("When refresh is concurrent, then exactly one request succeeds") |
| S11 | Password changes revoke refresh sessions | `test/e2e/auth.spec.ts` (password change test); `src/auth/auth.service.spec.ts` |
| S12 | Session-store failure fails closed | `src/auth/auth.service.spec.ts` ("When the session store fails, then login fails closed instead of returning tokens") |
| S13 | Errors never expose infrastructure internals | `test/e2e/http-platform.spec.ts` ("When an unhandled exception occurs, then the response hides infrastructure internals behind the generic error contract") |
| S14 | Logs never expose authentication secrets | `test/e2e/logging.spec.ts` (real `LoggerModule.forRoot` + production `pinoRedaction` wiring); `src/platform/logging/platform-logger.spec.ts` |
| S15 | Sorting uses an explicit allowlist | `test/e2e/admin-users.spec.ts` (`sortBy=passwordHash` → 400 `VALIDATION_ERROR`); `src/users/users.repository.ts` (`sortFieldMap`) |
| S16 | All requests are traceable through a request ID | `test/e2e/http-platform.spec.ts` (request ID propagation tests); `test/e2e/auth.spec.ts` (`requestId` on error bodies) |
