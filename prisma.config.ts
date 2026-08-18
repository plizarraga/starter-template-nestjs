import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// `process.env` (not the strict `env()` helper) so commands that don't need a
// database connection — `prisma generate` in CI or in a Docker build — still
// work without `DATABASE_URL` set. Connection-only commands (migrate/deploy)
// fail with a clear Prisma error when the URL is actually required.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
  migrations: {
    seed: 'ts-node prisma/seed-admin.ts',
  },
});