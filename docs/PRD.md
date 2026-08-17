# Backend Starter — Product Requirements Document

## 1. Overview

Backend Starter is a reusable specification for building production-oriented backend application starters across different languages, frameworks, and technology stacks.

The specification defines the expected product capabilities and architectural behavior without prescribing implementation technologies.

A concrete starter may be implemented using any suitable ecosystem, including JavaScript/TypeScript, Python, Ruby, Go, Java, or others.

Framework, ORM, database client, cache client, testing framework, and infrastructure-specific implementation decisions belong in the corresponding Engineering Design Document (EDD), not in this PRD.

---

# 2. Problem Statement

Most backend applications repeatedly implement the same foundational concerns:

- user authentication;
- authorization;
- user management;
- access and refresh credentials;
- session revocation;
- password security;
- pagination;
- search;
- sorting;
- error handling;
- logging;
- validation;
- testing;
- security configuration.

Implementing these concerns independently for every project increases development time and creates inconsistencies in security and architecture.

Backend Starter defines a reusable baseline so new backend projects can begin with these concerns already designed consistently.

---

# 3. Product Goal

Provide a small, secure, production-oriented backend foundation that can be implemented consistently across multiple languages and frameworks.

The starter should provide enough infrastructure to begin building application-specific functionality without becoming a full application framework.

---

# 4. Design Principles

All implementations must follow these principles.

## 4.1 Technology Agnostic

Product behavior must not depend on a particular:

- programming language;
- framework;
- ORM;
- relational database;
- cache implementation;
- logging library;
- testing framework.

Technology choices belong in implementation-specific EDDs.

## 4.2 Secure by Default

Authentication, credentials, passwords, cookies, errors, and logs must use secure defaults.

## 4.3 Stateless High-Frequency Authentication

Normal authenticated API requests should not require a centralized session lookup.

## 4.4 Stateful Revocation

Long-lived authentication sessions must remain revocable server-side.

## 4.5 Clear Separation of Concerns

Authentication, authorization, users, persistence, session state, errors, and logging should remain conceptually separate.

## 4.6 Standardized Cross-Cutting Concerns

Errors and logs must follow application-wide standards rather than being independently designed by each feature.

## 4.7 Small Core

The starter should provide foundational capabilities without introducing unnecessary business functionality.

---

# 5. Core Capabilities

Every implementation must provide:

1. User management
2. Authentication
3. Short-lived access credentials
4. Long-lived revocable refresh credentials
5. Refresh credential rotation
6. Session management
7. Authorization using RBAC
8. Password management
9. Pagination
10. User search
11. User sorting
12. Request validation
13. Centralized error handling
14. Centralized logging
15. Structured application errors
16. Structured application logs
17. Automated testing
18. Environment-driven configuration

---

# 6. Authentication

The starter must support authentication using:

```text
identifier + password
```

Email is the default user identifier.

Authentication must produce two credentials with separate responsibilities:

```text
               Authentication
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
   Access Credential       Refresh Credential
          │                       │
    short-lived               long-lived
    stateless                 stateful
    high frequency            revocable
```

---

# 7. Access Credentials

Access credentials must:

- be cryptographically verifiable;
- have a short lifetime;
- identify the authenticated user;
- contain sufficient authorization information;
- be verifiable without querying persistent user storage;
- be verifiable without querying the session store during normal requests.

The default architecture assumes access credentials cannot be individually revoked after issuance.

Their expiration time bounds the residual access window if compromised.

---

# 8. Refresh Credentials

Refresh credentials must:

- be cryptographically secure;
- be opaque to clients;
- have longer lifetimes than access credentials;
- be associated with server-side session state;
- be revocable;
- support rotation;
- only be used to obtain new access credentials.

Refresh credentials must not be treated as long-lived access credentials.

---

# 9. Authentication Sessions

Each login creates an independent authentication session.

A user may have multiple simultaneous sessions.

Example:

```text
User
 │
 ├── Laptop
 ├── Phone
 └── Tablet
```

Each session must be independently revocable.

Session state must support automatic expiration.

---

# 10. Refresh Rotation

Successful refresh must rotate the refresh credential.

```text
Refresh A
    │
    ▼
validate
    │
    ▼
rotate
    │
    ├── Access B
    └── Refresh B
```

After successful rotation:

```text
Refresh A → invalid
Refresh B → valid
```

Concurrent attempts to consume the same refresh credential must not result in multiple successful rotations.

---

# 11. Logout

The starter must distinguish between:

```text
logout
```

and:

```text
logout all
```

Logout revokes the current authentication session.

Logout-all revokes every active refresh session belonging to the authenticated user.

Already issued access credentials may remain valid until expiration.

---

# 12. Password Changes

Authenticated users must be able to change their password.

A successful password change must:

1. validate the current password;
2. validate the new password;
3. securely hash the new password;
4. update persistent user data;
5. revoke existing refresh sessions.

Previously issued access credentials may remain valid until expiration.

---

# 13. Password Security

Passwords must:

- never be stored in plaintext;
- use an appropriate password-hashing algorithm;
- never appear in API responses;
- never appear in application logs.

Password policy should prioritize adequate password length and secure hashing.

---

# 14. Authorization

The starter must provide Role-Based Access Control (RBAC).

Initial roles:

```text
USER
ADMIN
```

Authorization answers:

> Is the authenticated user allowed to perform this operation?

Authentication answers:

> Who is making this request?

These concerns must remain separate.

---

# 15. Public Registration

Public registration must assign the default non-privileged role.

Clients must never be able to assign privileged roles through the public registration API.

---

# 16. User Management

The starter must provide authenticated user profile operations and administrative user-management operations.

Minimum capabilities:

- retrieve current user;
- update current user;
- retrieve users;
- retrieve a specific user;
- administratively update a user.

Administrative operations must require appropriate authorization.

---

# 17. User Listing

User listing must support:

- pagination;
- search;
- sorting.

Example conceptually:

```text
users
  ? page
  & limit
  & search
  & sortBy
  & sortOrder
```

Implementations may adapt transport syntax where required, but the behavior must remain consistent.

---

# 18. Pagination

The initial product uses page-based pagination.

Required concepts:

```text
page
limit
```

Reasonable defaults and a maximum page size must be enforced.

Responses must provide pagination metadata sufficient for clients to navigate the collection.

---

# 19. Search

User listing must support textual search.

The initial searchable field is:

```text
email
```

Implementations may expand searchable fields in future versions.

Search must be handled safely by the persistence implementation.

---

# 20. Sorting

User listing must support ascending and descending sorting.

Only explicitly supported fields may be used for sorting.

Clients must not be able to inject arbitrary persistence expressions through sorting parameters.

---

# 21. Request Validation

All external input must be validated before entering business logic.

Validation must support:

- expected data types;
- required fields;
- format validation;
- allowed values;
- rejection of unexpected properties where appropriate.

Persistence models must not implicitly define the public request contract.

---

# 22. Centralized Error Handling

All application errors must pass through a centralized error-handling mechanism.

Individual controllers/routes should not independently define incompatible error response formats.

The error layer must normalize:

- validation errors;
- authentication errors;
- authorization errors;
- application/domain errors;
- persistence errors;
- infrastructure errors;
- unexpected errors.

---

# 23. Standard Error Contract

API errors must expose a predictable structure containing at minimum:

```text
statusCode
code
message
timestamp
path
requestId
```

Error codes must be stable and machine-readable.

Infrastructure-specific error details must not be exposed to clients.

---

# 24. Error Security

Production error responses must not expose:

- stack traces;
- database internals;
- cache internals;
- queries;
- credentials;
- secrets;
- filesystem paths;
- internal implementation details.

Unexpected errors must be mapped to a generic internal-server-error contract.

---

# 25. Centralized Logging

Logging must be centralized and standardized across the application.

Feature modules should emit structured events through the application's logging abstraction rather than directly coupling themselves to a specific logging provider.

---

# 26. Structured Logging

Application logs should contain structured fields such as:

```text
level
event
timestamp
requestId
userId
sessionId
```

where applicable.

Logs should be machine-readable and suitable for ingestion by external observability systems.

---

# 27. Request Correlation

Every incoming request must receive or propagate a request identifier.

The same identifier must be available to:

- request logging;
- application logging;
- error logging;
- error responses.

This allows a client error to be correlated with server-side logs.

---

# 28. Sensitive Data Logging

Logs must never contain:

- plaintext passwords;
- password hashes;
- raw refresh credentials;
- signing secrets;
- authentication cookies;
- authorization headers;
- database credentials;
- session-store credentials.

Access credentials should not be logged unnecessarily.

---

# 29. Authentication Security Events

The system should log structured security events for operations including:

```text
registration success
login success
login failure
refresh success
refresh failure
logout
logout all
password change
session revocation
authorization denial
```

---

# 30. Browser Credential Storage

For browser clients, long-lived refresh credentials should use browser storage mechanisms that prevent direct JavaScript access where possible.

Production deployments must support secure transport.

Cookie-based authentication must explicitly account for CSRF.

The starter must not recommend browser local storage as the default location for long-lived authentication credentials.

---

# 31. Configuration

Application configuration must be environment-driven.

At minimum, implementations must support configuration for:

- application environment;
- server;
- persistent storage;
- session storage;
- access credential signing;
- access credential lifetime;
- refresh credential lifetime;
- refresh credential protection;
- cookie security;
- allowed origins;
- logging.

Critical configuration must be validated during application startup.

---

# 32. Failure Behavior

Infrastructure failures must fail safely.

If session storage becomes unavailable:

- normal cryptographic access-token verification may continue;
- refresh must fail;
- session revocation operations must not report false success;
- unavailable session state must never be interpreted as valid.

If persistent storage becomes unavailable:

- access-token cryptographic verification may remain possible;
- operations requiring persistent application data may fail.

---

# 33. Testing

Every implementation must provide automated tests for critical behavior.

The exact testing framework belongs in the implementation-specific EDD.

Required test categories:

```text
Unit
Integration
End-to-End
```

Security-critical authentication behavior must have E2E coverage.

---

# 34. Critical Test Scenarios

Every implementation must verify:

- registration;
- duplicate registration;
- valid login;
- invalid login;
- access-token validation;
- refresh;
- refresh rotation;
- refresh reuse rejection;
- concurrent refresh behavior;
- logout;
- logout-all;
- password change;
- session revocation;
- RBAC;
- pagination;
- search;
- sorting;
- standardized errors;
- request correlation.

---

# 35. Performance Requirements

Authentication of ordinary protected requests must not require persistent user or session lookups.

Conceptually:

```text
High-frequency path

Request
   │
   ▼
Access credential verification
   │
   ▼
Authorization
   │
   ▼
Application
```

Session storage belongs on the lower-frequency authentication lifecycle path:

```text
Refresh
   │
   ▼
Session Store
   │
   ▼
Rotation / Revocation
```

---

# 36. Scalability

Application instances should remain disposable and horizontally scalable.

Authentication session state must not exist exclusively in the memory of an individual application instance.

Any application instance should be capable of processing a valid authentication-session operation.

---

# 37. Non-Goals

The initial specification does not require:

- OAuth authorization server functionality;
- OpenID Connect provider functionality;
- social login;
- SAML;
- multi-factor authentication;
- passwordless authentication;
- API keys;
- ABAC;
- fine-grained permissions;
- multi-tenancy;
- organizations;
- billing;
- email verification;
- password recovery;
- access-token blacklist;
- administrative UI.

These capabilities may be introduced by downstream starters or applications.

---

# 38. Product Acceptance Criteria

A conforming starter must satisfy all of the following:

- [ ] Users can register.
- [ ] Passwords are securely hashed.
- [ ] Public registration cannot assign privileged roles.
- [ ] Users can authenticate.
- [ ] Authentication creates independent sessions.
- [ ] Access credentials are short-lived.
- [ ] Normal access validation is stateless.
- [ ] Normal access validation requires no persistent-user lookup.
- [ ] Normal access validation requires no session lookup.
- [ ] Refresh credentials are opaque.
- [ ] Refresh sessions are revocable.
- [ ] Refresh credentials rotate.
- [ ] Used refresh credentials cannot be reused successfully.
- [ ] Concurrent refresh cannot successfully consume one credential multiple times.
- [ ] Multiple sessions per user are supported.
- [ ] Current-session logout works.
- [ ] Logout-all works.
- [ ] Password changes revoke refresh sessions.
- [ ] RBAC supports `USER` and `ADMIN`.
- [ ] User listing supports pagination.
- [ ] User listing supports search.
- [ ] User listing supports sorting.
- [ ] Request validation is centralized.
- [ ] Error handling is centralized.
- [ ] Errors follow a standard contract.
- [ ] Logging is centralized.
- [ ] Logs are structured.
- [ ] Requests can be correlated through a request ID.
- [ ] Sensitive authentication information is not logged.
- [ ] Critical functionality has automated tests.
- [ ] Security-critical flows have E2E tests.

---

# 39. Core Product Invariants

### Authentication

> Access is short-lived and stateless. Refresh is long-lived, stateful, rotating, and revocable.

### Persistence

> Persistent user/application data and ephemeral authentication-session state are separate concerns.

### Authorization

> Authentication establishes identity. Authorization determines permitted operations.

### Errors

> Every error exposed by the API follows the same application-wide contract.

### Logging

> Every component uses the same structured logging and request-correlation model.

### Security

> Credentials and infrastructure internals are never exposed unnecessarily.

### Portability

> Product requirements describe behavior. Technology-specific implementation decisions belong in the EDD.