import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
    },
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          // prisma/ holds the seed tooling and its colocated spec, which is a
          // unit test like any other and must not fall out of the suite.
          include: ['src/**/*.spec.ts', 'prisma/**/*.spec.ts'],
          setupFiles: ['test/support/default-environment.ts'],
        },
      },
      {
        test: {
          name: 'integration',
          environment: 'node',
          include: ['test/integration/**/*.spec.ts'],
          setupFiles: ['test/support/default-environment.ts'],
        },
      },
      {
        test: {
          name: 'e2e',
          environment: 'node',
          include: ['test/e2e/**/*.spec.ts'],
          setupFiles: ['test/support/default-environment.ts'],
        },
      },
    ],
  },
});
