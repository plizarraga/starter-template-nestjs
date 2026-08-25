import { describe, expect, it, vi } from 'vitest';
import { PlatformError } from '../errors/platform-error';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('disconnects the Prisma client when its module is destroyed', async () => {
    const service = Object.create(PrismaService.prototype) as PrismaService;
    const disconnect = vi.fn().mockResolvedValue(undefined);
    service.$disconnect = disconnect;

    await service.onModuleDestroy();

    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('maps an unavailable database connection to a safe platform error', async () => {
    const service = Object.create(PrismaService.prototype) as PrismaService;
    const queryRaw = vi.fn().mockRejectedValue(new Error('connection refused'));
    service.$queryRaw = queryRaw;

    await expect(service.check()).rejects.toEqual(
      new PlatformError('SERVICE_UNAVAILABLE'),
    );
    expect(queryRaw).toHaveBeenCalledWith(
      expect.objectContaining({ raw: ['SELECT 1'] }),
    );
  });
});
