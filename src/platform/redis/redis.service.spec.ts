import { describe, expect, it, vi } from 'vitest';
import { PlatformError } from '../errors/platform-error';
import { RedisService } from './redis.service';

describe('RedisService', () => {
  it('maps an unavailable Redis connection to a safe platform error', async () => {
    const client = {
      ping: vi.fn().mockRejectedValue(new Error('connection refused')),
    };
    const service = new RedisService(client as never);

    await expect(service.check()).rejects.toEqual(
      new PlatformError('SERVICE_UNAVAILABLE'),
    );
  });
});
