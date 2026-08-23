import { describe, expect, it } from 'vitest';
import { HealthService } from './health.service';

describe('HealthService', () => {
  it('reports PostgreSQL up when its check succeeds', async () => {
    const prisma = { check: () => Promise.resolve() };
    const service = new HealthService(prisma as never);

    await expect(service.checkReadiness()).resolves.toEqual({
      ready: true,
      checks: { postgres: 'up' },
    });
  });

  it('reports PostgreSQL down when its check fails', async () => {
    const prisma = {
      check: () => Promise.reject(new Error('connection refused')),
    };
    const service = new HealthService(prisma as never);

    await expect(service.checkReadiness()).resolves.toEqual({
      ready: false,
      checks: { postgres: 'down' },
    });
  });
});
