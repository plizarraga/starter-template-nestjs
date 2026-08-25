# Backend Starter - Product Requirements

Backend Starter is a production-oriented NestJS foundation for applications
that need email/password identity, role-based user administration, and a small
set of reliable platform capabilities.

## Product Goal

Start application-domain work from a secure, documented baseline rather than
rebuilding identity, authorization, validation, logging, and persistence in
each project.

## Core Capabilities

- Better Auth provides native email/password sign-up, sign-in, sign-out, and
  session APIs under `/api/auth`.
- Browser clients authenticate with HTTP-only session cookies.
- Sessions expire after seven days of inactivity and active sessions renew at
  most once per day.
- Roles are `USER` and `ADMIN`. Public registration creates `USER` only.
- Starter-owned user APIs expose the current profile plus administrator listing,
  lookup, and update operations.
- The final administrator cannot be removed, and an administrator cannot remove
  their own administrator role.
- An idempotent environment-driven command creates or promotes the initial
  administrator.
- PostgreSQL is the only runtime infrastructure dependency.
- Request validation, stable starter-owned error responses, structured logging,
  request IDs, rate-limited starter-owned routes, and liveness/readiness
  endpoints are available by default.
- Deployments drain in-flight requests and release datastore connections on
  shutdown.
- Unit, integration, and HTTP E2E tests protect the critical paths.

## Security Principles

- Password processing and authentication responses are owned by Better Auth.
- Browser credentials are never stored in JavaScript.
- Authentication cookies, passwords, secrets, and database URLs are redacted
  from application logs.
- Trusted browser origins are explicit configuration.
- User authorization is applied after session identity is established.
- Public registration never accepts a role choice.

## Scope Boundaries

The starter deliberately does not enable email verification, password recovery,
social sign-in, passkeys, multi-factor authentication, organizations, SSO, or
an administrative UI. Enable those Better Auth capabilities only when a
product requirement needs them.

## Acceptance Criteria

- [x] A browser can create an account and sign in through Better Auth native
  routes.
- [x] A session cookie grants access to protected user routes and renews during
  normal activity.
- [x] Administrators can manage users while regular users cannot access
  administrator endpoints.
- [x] The last-administrator business rule is enforced.
- [x] Local development, deployment, and readiness require PostgreSQL only.
- [x] Configuration and operational guidance describe the live contract.
