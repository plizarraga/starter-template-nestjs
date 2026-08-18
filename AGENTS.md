# AGENTS.md

## What this repo is

Fresh NestJS 11 (TypeScript) scaffold. The current `src/` is only the default
"Hello World!" app: `AppController`, `AppService`, `AppModule`.

The real target is a full backend defined in the `docs/` folder:

- `docs/PRD.md` — product requirements.
- `docs/PRODUCT_SPEC.md` — the behavioral/API contract: auth (short-lived
  access tokens + long-lived rotating, revocable refresh tokens), RBAC
  (`USER`/`ADMIN`), user CRUD with pagination/search/sort, and centralized
  validation, errors, logging, and config.

**None of it is implemented yet.** Before adding features, read
`docs/PRODUCT_SPEC.md` — it fixes the endpoint surface, the standard error
shape (`statusCode`, `code`, `message`, `timestamp`, `path`, `requestId`), and
the security invariants (S1–S16) that must hold. `docs/EDD.md` selects the
NestJS implementation technology and architecture; update it when those
decisions change.

## Package manager

pnpm only (`pnpm-lock.yaml`, `pnpm-workspace.yaml`). Do not use npm/yarn.

## ⚠️ Build-script approval gate (blocks everything)

`pnpm-workspace.yaml` ships with a placeholder that makes **every** `pnpm`
command fail (install, build, test, lint, start):

```
[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: unrs-resolver@1.12.2
```

Fix once, then it stays fixed:
`pnpm approve-builds` and enable `unrs-resolver`, or set
`allowBuilds: { unrs-resolver: true }` in `pnpm-workspace.yaml`.

## Commands

| Task | Command |
| --- | --- |
| dev (watch) | `pnpm start:dev` |
| build | `pnpm build` |
| unit tests | `pnpm test` |
| one test file | `pnpm test -- <pattern>` (Vitest pattern) |
| e2e tests | `pnpm test:e2e` |
| coverage | `pnpm test:cov` |
| lint | `pnpm lint` — runs eslint **with `--fix`** |
| format | `pnpm format` (prettier --write over `src/**/*.ts` `test/**/*.ts`) |

## Testing layout

- Unit tests are colocated in `src/**/*.spec.ts`.
- Integration tests live in `test/integration/**/*.spec.ts`; E2E tests live in
  `test/e2e/**/*.spec.ts`. Vitest projects select each suite.
- `test/` and `**/*spec.ts` are excluded from the production build via
  `tsconfig.build.json`.

## Style / lint

- ESLint flat config (`eslint.config.mjs`): type-checked
  `typescript-eslint` rules + `eslint-plugin-prettier`, so **Prettier
  violations are lint errors**, not just formatting drift.
- Prettier: `singleQuote: true`, `trailingComma: "all"`.
- `@typescript-eslint/no-explicit-any` is `off`; `no-floating-promises` is
  `warn`.

## Config quirks

- `tsconfig.json` uses `module: nodenext` / `moduleResolution: nodenext` (not
  Nest's default `commonjs`), but `package.json` has no `"type": "module"`, so
  sources compile to CommonJS and extensionless relative imports are fine.
- Not full strict mode: `strictNullChecks: true` but `noImplicitAny: false`.
- No `@nestjs/config`, no DB/ORM, no CI workflows, no pre-commit hooks, no
  `.env` handling — there is no env-based config or persistence to wire into
  yet.

## Agent skills

### Issue tracker

Issues live as local Markdown files under `.scratch/`. See
`docs/agents/issue-tracker.md`.

### Triage labels

Use the canonical triage label vocabulary. See
`docs/agents/triage-labels.md`.

### Domain docs

Use the single-context domain-doc layout. See `docs/agents/domain.md`.
