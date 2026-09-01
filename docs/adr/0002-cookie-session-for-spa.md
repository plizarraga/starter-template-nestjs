# Cookie sessions for a browser SPA: HTTP-only session cookies rather than bearer tokens

Status: accepted

The Authenticated Client this starter is built for is a browser SPA, and it
authenticates with Better Auth's HTTP-only session cookie. That was a choice
between two supported options, not the absence of one: Better Auth ships a
`bearer` plugin next to the `openAPI` plugin this starter already enables, and
the starter deliberately enables only the latter.

The cookie wins for a browser client because it removes work the SPA would
otherwise have to get right. There is no token for the client to store, so
there is no decision about `localStorage` versus memory, and no session lost or
leaked by choosing wrong — the browser holds the credential and attaches it on
its own. `HttpOnly` keeps that credential unreadable by injected JavaScript, so
an XSS foothold can act inside the session but cannot exfiltrate a token that
outlives the page. And the rolling Session Lifetime renews through the same
cookie, so there is no refresh-token rotation to implement, no rotation race to
handle, and no second credential to revoke.

## Consequences

A native mobile client is not served by this default. Mobile has no cookie jar
the starter can rely on and needs a bearer-token scheme instead. The same is
true of any non-browser consumer, machine-to-machine callers included: there is
no second authentication path in this starter today.

That change happens at one seam — the `plugins` array in `createAuthInstance`
(`src/features/auth/better-auth.service.ts`), which today reads
`plugins: [openAPI()]`. Adding `bearer()` from `better-auth/plugins`, wired the
same way `openAPI()` is, is the whole integration point. Per the installed
`better-auth` package's own plugin source (`better-auth/plugins`, not code this
starter owns), the plugin runs as a `before` hook that rewrites an
`Authorization: bearer <token>` header into the session cookie on the request
before the session is resolved, so `BetterAuthService.getSession` and
`SessionGuard` keep working unchanged, and Better Auth returns the token to the
client in a `set-auth-token` response header on its native routes. Nothing in
the request pipeline moves: the
`HttpExtension` contract (`src/core/http/http-extension.ts`) and
`configureApplication` mount the same handler either way. The default is meant
to be changed when the client is not a browser — not worked around.

The cost of the cookie is CSRF exposure, and it is real. A bearer token in an
`Authorization` header is attached by the client, so a hostile cross-origin page
cannot silently make an authenticated request with it. A cookie is attached by
the browser, so it can. This starter answers that in two places. Under the
default `same-site` topology, the answer is the cookie attribute itself:
`SameSite=Lax` means the browser does not send the session cookie on
cross-site state-changing requests, and that is the primary protection. Under
`DEPLOYMENT_TOPOLOGY=cross-site` the cookie becomes
`SameSite=None; Secure; Partitioned` so a client on another registrable domain
still receives it, which surrenders that browser-level protection outright;
`OriginGuard` (`src/core/access-control/origin.guard.ts`) replaces it with an
exact `Origin` check against `CORS_ORIGINS` for `POST`, `PUT`, `PATCH`, and
`DELETE` on starter-owned routes, and Better Auth applies its own trusted-origin
check to the native routes at `/api/auth`.

That replacement is not equivalent, and a cross-site deployment should be
adopted knowing it. An origin check is an application-level control that
depends on the browser sending `Origin`, on `CORS_ORIGINS` being kept narrow,
and on state-changing work actually living behind a state-changing method —
safe methods are not checked. `SameSite=Lax` needs none of that to hold. A
cross-site topology is therefore a deliberate step down in CSRF posture, taken
because the deployment requires it, not because the two are equally strong.
