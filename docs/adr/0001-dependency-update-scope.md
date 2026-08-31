# Dependency update scope: NestJS 12 on CommonJS, TypeScript and Prisma held back

Status: accepted

Before reusing this starter as the base for a new project, we updated its dependencies. NestJS 11→12 was in scope and applied via `nest upgrade`, staying on CommonJS: Nest 12's packages are ESM-only, but Node's `require(esm)` support lets a CJS app consume them without a full rewrite, and a full ESM migration (import extensions, `tsconfig` `nodenext`, `ts-node` ESM loader for seed scripts) has unverified compatibility risk with Prisma, better-auth, and nestjs-pino.

TypeScript 6→7 and Prisma 7→8 were explicitly left out. TypeScript 7 makes `typescript-eslint` 8.x throw at runtime (`does not support TS 7.0`), with no compatible release yet. Prisma 8 was still `8.0.0-rc.12` at decision time — a release candidate, not GA.

## Consequences

Someone updating dependencies later will find the repo intentionally behind the latest tags for `typescript`, `prisma`, and the ESM form of `@nestjs/*` — this is deliberate, not neglect. Revisit TypeScript 7 once `typescript-eslint` supports it, Prisma 8 once it reaches GA, and ESM only as its own dedicated migration with hands-on verification of Prisma/better-auth/nestjs-pino compatibility.
