import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestEnvironment,
  TestEnvironment,
} from '../support/test-environment';

describe('test dependencies', () => {
  let environment: TestEnvironment;

  beforeAll(async () => {
    environment = await createTestEnvironment();
  }, 120_000);

  afterAll(async () => {
    await environment?.stop();
  }, 120_000);

  it('starts an isolated PostgreSQL service', () => {
    expect(environment.databaseUrl).toMatch(/^postgres(?:ql)?:/);
    expect(environment.schema).toMatch(/^test_[a-f0-9]+$/);
  });

  it('creates a fresh PostgreSQL schema', async () => {
    await expect(environment.verifyIsolation()).resolves.toBe(true);
  });
});
