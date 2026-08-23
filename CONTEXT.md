# Backend Starter

The Backend Starter provides a reusable backend foundation with identity, user
management, and platform capabilities.

## Identity

**Identity Provider**:
Better Auth is the official authentication solution for the starter template.
_Avoid_: custom auth provider, interchangeable auth provider

**Email/Password Authentication**:
The initial credential method supported by the Identity Provider, using an
email address and password to establish a user's identity.
_Avoid_: custom JWT login, refresh-token authentication

**Authentication API**:
The native HTTP routes and response shapes supplied by Better Auth.
_Avoid_: custom `/auth/*` adapter, legacy authentication contract

**User Role**:
The application's `USER` or `ADMIN` authorization classification, stored on
the Better Auth user. The starter owns the meaning and enforcement of roles.
_Avoid_: separate application profile, duplicate user record

**Authenticated Client**:
A client with a Better Auth session cookie used to access protected starter
routes.
_Avoid_: default Bearer-token client, custom refresh-token client

**Session Lifetime**:
A rolling seven-day Better Auth session. Active sessions extend at most once
per day; inactive sessions expire and require a new sign-in.
_Avoid_: frontend refresh-token flow, fixed short-lived access token

**Email Verification**:
An optional confirmation that a user controls their registered email address.
It is disabled in the starter's initial configuration.
_Avoid_: mandatory account activation

**Password Recovery**:
An optional email-based process for replacing a forgotten password. It is not
included in the starter's initial configuration.
_Avoid_: built-in recovery flow

**Administrator Bootstrap**:
An idempotent deployment command that creates or promotes the first `ADMIN`
from environment variables.
_Avoid_: administrator public registration, manual database promotion

**Authentication Rate Limit**:
Better Auth's native protection applied to sign-up and sign-in routes against
automated abuse.
_Avoid_: Redis-backed rate limiter, unprotected native auth routes

**Trusted Origin**:
An explicitly configured client origin permitted to make authenticated
session-cookie requests.
_Avoid_: implicit cross-origin trust, wildcard production origin

## User Administration

**User Administration API**:
The starter-owned self-service and administrator-facing API for users. It is
separate from Better Auth's native authentication API.
_Avoid_: delegating authorization rules to the Identity Provider

**Authentication Error Contract**:
The native Better Auth error responses returned by its authentication routes.
The platform error contract applies only to starter-owned endpoints.
_Avoid_: normalizing Better Auth errors through a custom adapter

**Authentication Audit Event**:
An outcome recorded through centralized logging for a Better Auth operation,
with credentials and session secrets redacted.
_Avoid_: logging passwords, cookies, tokens, or ad hoc route logs

**Legacy Authentication Contract**:
The removed custom JWT access-token and Redis rotating-refresh-token model.
It has no compatibility guarantee or remaining documentation.
_Avoid_: legacy auth routes, legacy auth configuration, dual auth systems
