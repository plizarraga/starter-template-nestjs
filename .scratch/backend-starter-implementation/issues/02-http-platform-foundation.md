# 02 — Build HTTP platform foundation

**What to build:** The API starts with validated environment configuration and provides a consistent, secure HTTP boundary before any feature endpoint is added.

**Blocked by:** 01 — Prepare toolchain and local environment.

**Status:** ready-for-agent

- [ ] Invalid required application configuration prevents startup, while unrelated container environment variables remain allowed.
- [ ] Validation rejects unknown input and every API error uses the standard response contract with a request ID.
- [ ] Request IDs, structured JSON logs, centralized sensitive-data redaction, Helmet, CORS, and non-production Swagger behavior are active and testable.
