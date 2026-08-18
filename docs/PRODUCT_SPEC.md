# Backend Starter — Product Specification

## 1. Purpose

This document defines the observable behavior and functional contracts required of every Backend Starter implementation.

It intentionally does not prescribe:

- programming language;
- web framework;
- ORM;
- database engine;
- session-store technology;
- logging library;
- validation library;
- testing framework.

Those decisions belong in each implementation's Engineering Design Document (EDD).

---

# 2. Product Boundary

The starter provides four primary product domains:

```text
Backend Starter
      │
      ├── Authentication
      ├── Authorization
      ├── Users
      └── Platform
             │
             ├── Validation
             ├── Errors
             ├── Logging
             └── Configuration
```

Authentication session storage and persistent storage are infrastructure requirements supporting these domains.

---

# 3. HTTP API

For HTTP-based implementations, the canonical API surface is:

```text
Authentication

POST   /auth/register
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
POST   /auth/logout-all
PATCH  /auth/password


Users

GET    /users/me
PATCH  /users/me

GET    /users
GET    /users/:id
PATCH  /users/:id


Operations

GET    /health/live
GET    /health/ready
```

Equivalent conventions may be used when a target platform requires them, provided product behavior remains equivalent.

The liveness endpoint confirms only that the process is responsive. The
readiness endpoint checks required infrastructure dependencies (persistent
storage and session storage) and returns a generic unhealthy response without
revealing connection details when either is unavailable — see §44–45.

---

# 4. User Representation

A user must contain at minimum:

```text
id
email
passwordHash
role
createdAt
updatedAt
```

Initial roles:

```text
USER
ADMIN
```

`passwordHash` is internal and must never be included in public user representations.

Public representation:

```json
{
  "id": "user-id",
  "email": "john@example.com",
  "role": "USER",
  "createdAt": "2026-08-17T20:00:00.000Z",
  "updatedAt": "2026-08-17T20:00:00.000Z"
}
```

---

# 5. Registration

## Request

```http
POST /auth/register
```

```json
{
  "email": "john@example.com",
  "password": "StrongPassword123!"
}
```

## Behavior

The system must:

1. validate input;
2. normalize the email;
3. enforce email uniqueness;
4. securely hash the password;
5. create the user;
6. assign `USER`;
7. return the public user representation.

The client must not be able to submit:

```json
{
  "role": "ADMIN"
}
```

through public registration.

## Success

```http
201 Created
```

## Duplicate Email

```http
409 Conflict
```

---

# 6. Login

## Request

```http
POST /auth/login
```

```json
{
  "email": "john@example.com",
  "password": "StrongPassword123!"
}
```

## Behavior

The system must:

1. normalize the identifier;
2. find the user;
3. verify the password;
4. create an independent authentication session;
5. issue a short-lived access credential;
6. issue a long-lived refresh credential.

## Response

Conceptually:

```json
{
  "accessToken": "<access-credential>",
  "expiresIn": 600,
  "tokenType": "Bearer"
}
```

For browser clients, the refresh credential should be transported separately using a secure HTTP-only mechanism.

---

# 7. Invalid Credentials

The API must not reveal whether:

```text
email does not exist
```

or:

```text
password is incorrect
```

Both conditions return:

```http
401 Unauthorized
```

with the same public error code:

```text
INVALID_CREDENTIALS
```

---

# 8. Access Credential

The access credential must contain enough information to establish:

```text
user identity
role
issuance
expiration
```

Conceptually:

```json
{
  "sub": "user-id",
  "role": "USER",
  "iat": 1786981200,
  "exp": 1786981800
}
```

The exact serialization/signing format is an implementation decision, provided the credential remains cryptographically verifiable without a session lookup.

Recommended default lifetime:

```text
10 minutes
```

The lifetime must be configurable.

---

# 9. Protected Request

Example:

```http
GET /users/me
Authorization: Bearer <access-token>
```

Processing:

```text
Request
   │
   ▼
verify access credential
   │
   ▼
establish authenticated principal
   │
   ▼
authorize
   │
   ▼
execute operation
```

Access authentication itself must not require:

```text
persistent user lookup
session-store lookup
```

---

# 10. Authenticated Principal

The internal authenticated principal contains at minimum:

```text
id
role
```

Example:

```json
{
  "id": "user-id",
  "role": "USER"
}
```

It represents authentication claims, not the complete persisted user entity.

---

# 11. Refresh Credential

Refresh credentials must be:

- cryptographically random;
- opaque;
- long-lived;
- revocable;
- rotatable.

They must not be used as ordinary API access credentials.

Each refresh credential is associated with an authentication session.

---

# 12. Session

Each successful login creates:

```text
sessionId
userId
refreshCredentialProtection
createdAt
expiresAt/TTL
```

The server should not persist raw refresh secrets when a protected representation is sufficient.

A user may have multiple active sessions.

---

# 13. Refresh

## Request

```http
POST /auth/refresh
```

The refresh credential is supplied through the configured transport.

## Behavior

The system must:

1. identify the session;
2. retrieve server-side session state;
3. validate the presented refresh credential;
4. reject expired/revoked sessions;
5. atomically rotate the refresh credential;
6. issue a new access credential;
7. return the replacement refresh credential through the configured transport.

## Success

```http
200 OK
```

```json
{
  "accessToken": "<new-access-token>",
  "expiresIn": 600,
  "tokenType": "Bearer"
}
```

---

# 14. Refresh Rotation

Given:

```text
Refresh A
```

a successful refresh produces:

```text
Access B
Refresh B
```

After completion:

```text
Refresh A → INVALID
Refresh B → VALID
```

Attempting to reuse `Refresh A` must return:

```http
401 Unauthorized
```

---

# 15. Concurrent Refresh

Given two simultaneous requests presenting the same refresh credential:

```text
                Refresh A
                   │
             ┌─────┴─────┐
             ▼           ▼
          Request 1   Request 2
```

exactly one may successfully consume and rotate the credential.

Expected:

```text
Request 1 → 200
Request 2 → 401
```

or the reverse.

The implementation must prevent both from succeeding.

---

# 16. Logout

## Request

```http
POST /auth/logout
```

## Behavior

The current refresh session must be revoked.

The refresh credential must no longer be accepted.

For browser clients, the refresh cookie must be cleared.

## Response

```http
204 No Content
```

Logout should be idempotent where practical.

---

# 17. Logout All

## Request

```http
POST /auth/logout-all
```

Requires valid authentication.

## Behavior

Every refresh session associated with the authenticated user must be revoked.

Given:

```text
User
 │
 ├── Session A
 ├── Session B
 └── Session C
```

after logout-all:

```text
Session A → revoked
Session B → revoked
Session C → revoked
```

## Response

```http
204 No Content
```

---

# 18. Access Credential After Logout

Logout and logout-all do not guarantee immediate invalidation of previously issued access credentials.

Example:

```text
Access issued     10:00
Logout-all        10:03
Access expires    10:10
```

The access credential may remain valid until `10:10`.

However, its refresh session is immediately unavailable.

Therefore the client cannot extend that authentication session beyond the existing access-credential lifetime.

---

# 19. Change Password

## Request

```http
PATCH /auth/password
```

```json
{
  "currentPassword": "CurrentPassword",
  "newPassword": "NewPassword"
}
```

## Behavior

The system must:

1. authenticate the request;
2. retrieve the user;
3. verify the current password;
4. validate the new password;
5. securely hash the new password;
6. update the password;
7. revoke all refresh sessions.

## Response

```http
204 No Content
```

---

# 20. Authorization

Authorization uses RBAC.

Initial roles:

```text
USER
ADMIN
```

A protected operation may declare one or more required roles.

Conceptually:

```text
Request
   │
   ▼
Authentication
   │
   ▼
Authenticated Principal
   │
   ▼
Required Roles
   │
   ├── match ──► operation
   │
   └── no match ──► 403
```

---

# 21. Authentication vs Authorization Errors

No valid authentication:

```http
401 Unauthorized
```

Valid authentication but insufficient role:

```http
403 Forbidden
```

The two cases must remain semantically distinct.

---

# 22. Current User

## Request

```http
GET /users/me
```

Requires authentication.

## Response

```http
200 OK
```

```json
{
  "id": "user-id",
  "email": "john@example.com",
  "role": "USER",
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

# 23. Update Current User

```http
PATCH /users/me
```

Requires authentication.

Only explicitly allowed profile fields may be modified.

Clients must not be able to modify privileged security properties through this endpoint.

---

# 24. List Users

```http
GET /users
```

Requires:

```text
ADMIN
```

Supports:

```text
pagination
search
sorting
```

Canonical query:

```http
GET /users?page=1&limit=20&search=john&sortBy=createdAt&sortOrder=desc
```

---

# 25. Pagination Parameters

Supported parameters:

```text
page
limit
```

Defaults:

```text
page  = 1
limit = 20
```

Recommended maximum:

```text
limit = 100
```

Invalid values must return a validation error rather than being silently interpreted unpredictably.

---

# 26. Paginated Response

Canonical response:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 57,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

`data` contains public user representations.

---

# 27. Search

Supported parameter:

```text
search
```

Initial searchable field:

```text
email
```

Example:

```http
GET /users?search=john
```

Search behavior should be case-insensitive where supported and consistent with the system's email normalization rules.

---

# 28. Sorting

Parameters:

```text
sortBy
sortOrder
```

Supported initial sort fields:

```text
email
role
createdAt
updatedAt
```

Supported directions:

```text
asc
desc
```

Recommended defaults:

```text
sortBy=createdAt
sortOrder=desc
```

Unsupported fields must be rejected.

---

# 29. Get User

```http
GET /users/:id
```

Requires:

```text
ADMIN
```

Unknown user:

```http
404 Not Found
```

Error code:

```text
USER_NOT_FOUND
```

---

# 30. Administrative User Update

```http
PATCH /users/:id
```

Requires:

```text
ADMIN
```

The implementation must explicitly define which administrative fields may be modified.

Role changes must be authorization-protected.

The system must prevent an operation that would leave zero users with the
`ADMIN` role, and must prevent an administrator from removing their own
`ADMIN` role. Both cases return:

```http
409 Conflict
```

---

# 31. Role Change Semantics

Because authorization claims exist in short-lived access credentials, changing:

```text
ADMIN → USER
```

does not necessarily alter an already issued credential immediately.

The maximum stale authorization window is bounded by:

```text
access credential TTL
```

This behavior must be documented.

---

# 32. Request Validation

All request bodies, path parameters, and query parameters must be validated.

Unknown body properties should be rejected where practical.

Example:

```json
{
  "email": "john@example.com",
  "password": "...",
  "isSuperAdmin": true
}
```

must not silently allow `isSuperAdmin`.

---

# 33. Standard Error Response

Every API error must use the same top-level contract:

```json
{
  "statusCode": 409,
  "code": "USER_EMAIL_ALREADY_EXISTS",
  "message": "A user with this email already exists",
  "timestamp": "2026-08-17T21:00:00.000Z",
  "path": "/auth/register",
  "requestId": "request-id"
}
```

Required properties:

```text
statusCode
code
message
timestamp
path
requestId
```

---

# 34. Validation Error Response

Validation errors may additionally expose safe field-level details.

Example:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "timestamp": "2026-08-17T21:00:00.000Z",
  "path": "/auth/register",
  "requestId": "request-id",
  "details": [
    {
      "field": "email",
      "code": "INVALID_EMAIL",
      "message": "Email must be valid"
    }
  ]
}
```

The `details` property is optional and intended for safe actionable validation information.

---

# 35. Standard Error Codes

Initial error codes should include:

```text
VALIDATION_ERROR

INVALID_CREDENTIALS
INVALID_ACCESS_TOKEN
ACCESS_TOKEN_EXPIRED

INVALID_REFRESH_TOKEN
REFRESH_TOKEN_EXPIRED
SESSION_NOT_FOUND

UNAUTHORIZED
FORBIDDEN
NOT_FOUND

USER_NOT_FOUND
USER_EMAIL_ALREADY_EXISTS
CANNOT_REMOVE_LAST_ADMIN
CANNOT_REMOVE_OWN_ADMIN_ROLE

RATE_LIMIT_EXCEEDED

INTERNAL_SERVER_ERROR
SERVICE_UNAVAILABLE
```

Error codes are part of the API contract and should remain stable.

---

# 36. Infrastructure Errors

Implementation-specific exceptions must be translated.

Conceptually:

```text
Persistence unique constraint
             │
             ▼
USER_EMAIL_ALREADY_EXISTS
             │
             ▼
409 Conflict
```

or:

```text
Unexpected infrastructure error
             │
             ▼
INTERNAL_SERVER_ERROR
             │
             ▼
500
```

Raw infrastructure errors must not be returned.

---

# 37. Request ID

Every request must have a unique correlation identifier.

If a trusted upstream system provides one according to deployment policy, it may be propagated.

Otherwise the application generates one.

The request ID must be available throughout the request lifecycle.

---

# 38. Request Logging

At minimum, HTTP request logging should support:

```text
requestId
method
path
statusCode
duration
timestamp
```

Authenticated requests may additionally contain:

```text
userId
```

when safe and available.

---

# 39. Application Logging

Feature events should use structured event names.

Examples:

```text
auth.register.success
auth.login.success
auth.login.failure
auth.refresh.success
auth.refresh.failure
auth.logout
auth.logout_all
auth.password_changed
auth.session.revoked
authorization.denied
```

Conceptual event:

```json
{
  "level": "info",
  "event": "auth.login.success",
  "requestId": "request-id",
  "userId": "user-id",
  "sessionId": "session-id",
  "timestamp": "2026-08-17T21:00:00.000Z"
}
```

---

# 40. Error Logging

Unexpected errors must be logged centrally.

The log may contain internal diagnostic context unavailable to the client, subject to sensitive-data redaction.

Example flow:

```text
Exception
    │
    ▼
Central Error Handler
    │
    ├──────────────► Structured Error Log
    │
    └──────────────► Standard Error Response
```

Both sides use the same:

```text
requestId
```

---

# 41. Sensitive Data Redaction

The logging system must redact or avoid:

```text
password
passwordHash
refresh credential
access credential
Authorization header
Cookie header
signing secrets
session-store credentials
database credentials
```

Redaction should be centralized rather than relying exclusively on individual developers.

---

# 42. Browser Refresh Cookie

Recommended behavior:

```text
HttpOnly = true
Secure   = true in production
SameSite = deployment appropriate
Path     = authentication endpoints
```

The exact cookie name is implementation-configurable.

When cross-site cookies are required, appropriate CSRF protection must also be implemented.

---

# 43. Configuration

Configuration must expose product-level settings for:

```text
application environment
server
persistent storage
session storage
access credential TTL
refresh credential TTL
access signing
refresh protection
cookie behavior
CORS/allowed origins
logging
```

Exact environment variable names belong in the EDD.

---

# 44. Session Store Failure

If session storage is unavailable:

```text
protected request with valid access credential
    → may continue

refresh
    → fail safely

logout
    → must not claim revocation if it did not occur

logout-all
    → must not claim revocation if it did not occur
```

Refresh validation must never fail open.

---

# 45. Persistent Store Failure

If persistent storage is unavailable:

```text
access credential verification
    → may remain possible
```

but operations requiring user/application data may return a service error.

---

# 46. Testing Contract

Every concrete implementation must provide:

```text
Unit tests
Integration tests
E2E tests
```

The technology used to implement these tests belongs in the EDD.

---

# 47. Required Authentication E2E Scenarios

```text
register
register duplicate
login success
login failure
protected access
invalid access credential
expired access credential
refresh
refresh rotation
refresh reuse
concurrent refresh
logout
logout-all
password change
```

---

# 48. Required User E2E Scenarios

```text
get current user
update current user

ADMIN list users
USER cannot list users

pagination
custom page size
maximum page size validation

search
search with no results

sort ascending
sort descending
invalid sort field

get user
user not found
administrative update
```

---

# 49. Required Error E2E Scenarios

Tests must verify the standardized contract for:

```text
400
401
403
404
409
500
```

where practical.

At minimum, assertions must validate:

```text
statusCode
code
message
timestamp
path
requestId
```

---

# 50. Required Logging Tests

Tests should verify that:

- request IDs propagate;
- structured events are emitted;
- authentication failures can be logged;
- unexpected exceptions are logged;
- sensitive credentials are not included in logs.

---

# 51. Security Invariants

The following are mandatory.

### S1

Passwords are never stored as plaintext.

### S2

Password hashes are never returned publicly.

### S3

Public registration cannot grant privileged roles.

### S4

Normal access authentication performs no session lookup.

### S5

Normal access authentication performs no persistent-user lookup.

### S6

Access credentials are short-lived.

### S7

Refresh sessions are revocable.

### S8

Refresh credentials rotate.

### S9

Consumed refresh credentials cannot be successfully reused.

### S10

Concurrent refresh cannot consume the same credential multiple times successfully.

### S11

Password changes revoke refresh sessions.

### S12

Session-store failure fails closed.

### S13

Errors never expose infrastructure internals.

### S14

Logs never expose authentication secrets.

### S15

Sorting uses an explicit allowlist.

### S16

All requests are traceable through a request ID.

---

# 52. Product Definition of Done

A concrete Backend Starter implementation is product-complete when:

- [x] Authentication endpoints conform to this specification.
- [x] Access authentication is stateless.
- [x] Refresh sessions are stateful and revocable.
- [x] Refresh rotation is concurrency-safe.
- [x] Password changes revoke sessions.
- [x] RBAC is enforced.
- [x] Users can manage their profile.
- [x] Administrators can manage users.
- [x] User listing supports pagination.
- [x] User listing supports search.
- [x] User listing supports sorting.
- [x] Input validation is standardized.
- [x] Error handling is centralized.
- [x] Error responses follow the standard contract.
- [x] Logging is centralized.
- [x] Logging is structured.
- [x] Request IDs propagate across logs and errors.
- [x] Sensitive information is redacted.
- [x] Infrastructure failures fail safely.
- [x] Unit tests exist.
- [x] Integration tests exist.
- [x] E2E tests cover critical security behavior.
- [x] Product behavior is documented independently from implementation technology.

The NestJS reference implementation satisfies every item above; its
engineering decisions are recorded in `EDD.md`, and the S1–S16 invariant
evidence is recorded per-test in that implementation's own tracking
(`.scratch/backend-starter-implementation/issues/10-verify-security-invariants.md`).

---

# 53. Relationship With Engineering Specifications

This specification defines:

```text
WHAT the starter does
+
HOW the product behaves
```

It deliberately does not define:

```text
HOW the code implements it
```

Each concrete starter must therefore have its own EDD.

For example:

```text
                   PRD.md
                      │
                      ▼
              PRODUCT_SPEC.md
                      │
       ┌──────────────┼───────────────┐
       ▼              ▼               ▼
 NestJS EDD      FastAPI EDD       Rails EDD
       │              │               │
       ▼              ▼               ▼
 NestJS Starter  FastAPI Starter  Rails Starter
```

The EDD is responsible for choosing:

- language;
- framework;
- ORM/data-access technology;
- database implementation;
- session-store implementation;
- authentication libraries;
- logging libraries;
- validation libraries;
- testing framework;
- source directory structure;
- dependency injection strategy;
- middleware/guard/filter mechanisms;
- exact configuration variables;
- package dependencies.

This separation allows the same product contract to be implemented consistently across multiple backend ecosystems.