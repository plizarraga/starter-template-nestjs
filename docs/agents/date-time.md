# Date and Time Handling

Rules for every date/time field touched in this repo — Prisma schema,
backend logic, and REST API contracts. Apply consistently.

**Core principle: never pick a date type for technical convenience.
Determine the semantics of the data first.** "What day?" and "at what exact
moment?" are different questions, even though both fields look like "a
date".

## Decision table

| Question it answers | Type |
| --- | --- |
| At what exact moment did/will it happen? | `DateTime` + `@db.Timestamptz`, UTC internally |
| What day? (no time, no timezone) | `DateTime` + `@db.Date` |
| At what local time? | Local time value |
| Must it repeat at a local time regardless of DST/offset changes? | Local time + IANA timezone |

## 1. Instants → `DateTime` + `Timestamptz`

Examples: `createdAt`, `updatedAt`, `expiresAt`, `emailVerifiedAt`,
`lastLoginAt`. This repo's existing models (`User`, `Session`, `Account`)
already follow this — see `prisma/schema.prisma`, which uses
`@db.Timestamptz(6)`. Match that precision for new instant fields.

```prisma
createdAt DateTime  @default(now()) @db.Timestamptz(6)
expiresAt DateTime?                 @db.Timestamptz(6)
```

A bare `timestamp` (Postgres' default, and what Prisma maps `DateTime` to
with no native-type annotation) stores a wall-clock number with no
timezone — its meaning depends on an invisible assumption about the writing
session. `Timestamptz` is not decoration; it's what makes the value
unambiguous.

## 2. Date-only values → `@db.Date`

Examples: `birthDate`, `dueDate`, `effectiveDate` — anything that only
answers "what day?", with no time or timezone concept.

```prisma
birthDate DateTime? @db.Date
```

```json
{ "birthDate": "1990-05-23" }
```

Never return a date-only value as a timestamp — `"1990-05-23T00:00:00.000Z"`
invites the client to shift it across a timezone boundary and land on the
22nd.

## 3. Recurring local time → local time + IANA timezone

Examples: "every day at 09:00", business hours, recurring notifications.
Don't collapse these into UTC — the UTC offset of a location changes (DST,
legislation); the business rule doesn't.

```json
{ "localTime": "09:00", "timezone": "America/Tijuana" }
```

Use IANA identifiers (`America/Tijuana`, `Europe/Madrid`), never fixed-offset
abbreviations (`PST`, `GMT-7`) — those don't survive DST.

## 4. Scheduled events → UTC instant, plus timezone when relevant

For appointments/meetings: store the real instant in UTC. If the timezone it
was scheduled under also matters as a fact, keep it as a separate field —
they answer different questions.

```prisma
startsAt DateTime @db.Timestamptz(6)
timezone String
```

## 5. REST API contracts

Instants: **ISO 8601 / RFC 3339 with an explicit timezone**, preferably UTC
(`2026-08-26T01:30:00.000Z`). An explicit offset (`-07:00` or `-0700`) is
also acceptable.

**Reject ambiguous datetimes on input.** A value with neither `Z` nor an
explicit offset (`2026-08-25T18:30:00`) does not identify a moment in time —
validate and reject it rather than assuming a timezone.
`new Date("2026-08-25T18:30:00")` resolves against the *server process's*
local timezone; `new Date("2026-08-25")` resolves to UTC midnight. Two
similar-looking inputs, two different rules, neither stated by the caller.

When the first DTO field representing an instant appears in this codebase
(e.g. a `fromDate`/`toDate` filter or an `expiresAt` input), add a shared
`@IsInstantString()` validator under `src/common/validators/` that requires
an explicit `Z` or numeric offset. Do not use `@IsDateString()` or
`@IsISO8601()` for that purpose — both accept a timezone-less datetime and
let it resolve unpredictably later.

## 6. Backend vs. frontend responsibility

**Backend must:** store instants in UTC as `Timestamptz`; use `@db.Date` for
pure dates; validate received timestamps, rejecting ambiguous ones; use IANA
timezones wherever a timezone is part of the domain; return timestamps as
ISO 8601 / RFC 3339.

**Frontend must:** convert UTC to the relevant timezone, format for
presentation, and apply locale. The backend must never send
human-preformatted timestamps (`"25 de agosto de 2026 a las 6:30 PM"` is
wrong; `"2026-08-26T01:30:00.000Z"` is right).

## 7. Deriving a calendar day

If a future feature needs to bucket instants into calendar days (a "today",
a daily report, a scheduler tick), the bucketing timezone must be named
explicitly and applied consistently — never derived from `CURRENT_DATE`,
`DATE(...)`, or `setUTCHours(0, 0, 0, 0)`, which silently assume UTC or the
server's local timezone. Pick one project timezone constant for that
purpose and convert through it explicitly, in both SQL (`AT TIME ZONE`) and
application code.

Unambiguous storage (rules 1–4) and explicit day-boundary conversion (this
rule) are separate requirements — satisfying one does not satisfy the other.
