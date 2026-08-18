import { describe, expect, it, vi } from 'vitest';
import { RedisThrottlerStorage } from './redis-throttler.storage';

describe('RedisThrottlerStorage', () => {
  it('delegates to the Redis-backed counter, namespaced by throttler name', async () => {
    const redis = {
      incrementRateLimit: vi.fn().mockResolvedValue({
        isBlocked: false,
        timeToBlockExpire: 0,
        timeToExpire: 900,
        totalHits: 1,
      }),
    };
    const storage = new RedisThrottlerStorage(redis as never);

    const result = await storage.increment(
      '1.2.3.4',
      900_000,
      10,
      900_000,
      'login',
    );

    expect(redis.incrementRateLimit).toHaveBeenCalledWith(
      'login:1.2.3.4',
      900_000,
      10,
    );
    expect(result).toEqual({
      isBlocked: false,
      timeToBlockExpire: 0,
      timeToExpire: 900,
      totalHits: 1,
    });
  });
});
