import { describe, expect, it, vi } from 'vitest';
import { PlatformError } from '../errors/platform-error';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('maps an unavailable database connection to a safe platform error', async () => {
    const service = Object.create(PrismaService.prototype) as PrismaService;
    service.$queryRawUnsafe = vi
      .fn()
      .mockRejectedValue(new Error('connection refused'));

    await expect(service.check()).rejects.toEqual(
      new PlatformError('SERVICE_UNAVAILABLE'),
    );
  });
});
