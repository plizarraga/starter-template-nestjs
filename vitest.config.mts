import vitest = require('vitest/config');

export = vitest.defineConfig({
  test: {
    coverage: {
      provider: 'v8',
    },
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.spec.ts'],
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
