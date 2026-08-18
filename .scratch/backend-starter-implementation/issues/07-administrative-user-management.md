# 07 — Enable administrative user management

**What to build:** Administrators can find, list, and update users while ordinary users cannot access administrative operations and administrative changes cannot remove the final administrator.

**Blocked by:** 04 — Enable registration, login, and access authentication.

**Status:** ready-for-agent

- [ ] Role-based authorization distinguishes 401 authentication failures from 403 authorization failures and records safe denial events.
- [ ] Administrators can retrieve a user and receive USER_NOT_FOUND for an unknown identifier.
- [ ] Administrators can list public users using validated pagination, normalized email search, and an explicit sorting allowlist.
- [ ] Administrative updates can change only allowed fields and preserve the invariant that an administrator cannot remove their own ADMIN role or leave zero administrators.
