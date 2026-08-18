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
});
