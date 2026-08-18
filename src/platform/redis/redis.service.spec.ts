import { describe, expect, it, vi } from 'vitest';
import { PlatformError } from '../errors/platform-error';
import { RedisService } from './redis.service';

describe('RedisService', () => {
  it('maps an unavailable Redis connection to a safe platform error', async () => {
    const client = {
      defineCommand: vi.fn(),
      ping: vi.fn().mockRejectedValue(new Error('connection refused')),
      status: 'ready',
    };
    const service = new RedisService(client as never);

    await expect(service.check()).rejects.toEqual(
      new PlatformError('SERVICE_UNAVAILABLE'),
    );
  });

  it('maps a Redis reconnection failure to a safe platform error', async () => {
    const client = {
      connect: vi.fn().mockRejectedValue(new Error('connection refused')),
      defineCommand: vi.fn(),
      ping: vi.fn(),
      status: 'end',
    };
    const service = new RedisService(client as never);

    await expect(service.check()).rejects.toEqual(
      new PlatformError('SERVICE_UNAVAILABLE'),
    );
  });

  it('reports a rate-limit counter as not blocked while under its limit', async () => {
    const client = {
      defineCommand: vi.fn(),
      incrementRateLimit: vi.fn().mockResolvedValue([3, 9000, 0]),
      status: 'ready',
    };
    const service = new RedisService(client as never);

    await expect(
      service.incrementRateLimit('login:1.2.3.4', 15000, 10),
    ).resolves.toEqual({
      isBlocked: false,
      timeToBlockExpire: 0,
      timeToExpire: 9,
      totalHits: 3,
    });
    expect(client.incrementRateLimit).toHaveBeenCalledWith(
      'rate-limit:login:1.2.3.4',
      15000,
      10,
    );
  });

  it('reports a rate-limit counter as blocked once it exceeds its limit', async () => {
    const client = {
      defineCommand: vi.fn(),
      incrementRateLimit: vi.fn().mockResolvedValue([11, 9000, 1]),
      status: 'ready',
    };
    const service = new RedisService(client as never);

    await expect(
      service.incrementRateLimit('login:1.2.3.4', 15000, 10),
    ).resolves.toEqual({
      isBlocked: true,
      timeToBlockExpire: 9,
      timeToExpire: 9,
      totalHits: 11,
    });
  });

  it('maps a rate-limit counter failure to a safe platform error', async () => {
    const client = {
      defineCommand: vi.fn(),
      incrementRateLimit: vi.fn().mockRejectedValue(new Error('down')),
      status: 'ready',
    };
    const service = new RedisService(client as never);

    await expect(
      service.incrementRateLimit('login:1.2.3.4', 15000, 10),
    ).rejects.toEqual(new PlatformError('SERVICE_UNAVAILABLE'));
  });
});
