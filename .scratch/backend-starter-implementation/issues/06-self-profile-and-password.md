# 06 — Add self profile and password management

**What to build:** An authenticated user can retrieve and safely update their own profile or change their password, with every credential-sensitive change revoking refresh sessions.

**Blocked by:** 05 — Implement refresh and session revocation.

**Status:** completed

- [x] Current-user retrieval returns only the public user representation.
- [x] Profile updates accept only the permitted fields, verify the current password, normalize email, and reject duplicate addresses through the standard contract.
- [x] Password changes verify the current password, enforce the password policy, update the protected hash, and revoke all refresh sessions.
