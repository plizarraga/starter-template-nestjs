import { describe, expect, it } from 'vitest';
import { HealthService } from './health.service';

describe('HealthService', () => {
  it('reports both dependencies up when every check succeeds', async () => {
    const prisma = { check: () => Promise.resolve() };
    const redis = { check: () => Promise.resolve() };
    const service = new HealthService(prisma as never, redis as never);

    await expect(service.checkReadiness()).resolves.toEqual({
      ready: true,
      checks: { postgres: 'up', redis: 'up' },
    });
  });

  it('reports Redis down while PostgreSQL stays up', async () => {
    const prisma = { check: () => Promise.resolve() };
    const redis = {
      check: () => Promise.reject(new Error('connection refused')),
    };
    const service = new HealthService(prisma as never, redis as never);

    await expect(service.checkReadiness()).resolves.toEqual({
      ready: false,
      checks: { postgres: 'up', redis: 'down' },
    });
  });

  it('reports PostgreSQL down while Redis stays up', async () => {
    const prisma = {
      check: () => Promise.reject(new Error('connection refused')),
    };
    const redis = { check: () => Promise.resolve() };
    const service = new HealthService(prisma as never, redis as never);

    await expect(service.checkReadiness()).resolves.toEqual({
      ready: false,
      checks: { postgres: 'down', redis: 'up' },
    });
  });

  it('reports both dependencies down', async () => {
    const prisma = {
      check: () => Promise.reject(new Error('connection refused')),
    };
    const redis = {
      check: () => Promise.reject(new Error('connection refused')),
    };
    const service = new HealthService(prisma as never, redis as never);

    await expect(service.checkReadiness()).resolves.toEqual({
      ready: false,
      checks: { postgres: 'down', redis: 'down' },
    });
  });
});
