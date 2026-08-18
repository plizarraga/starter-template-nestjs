import { describe, expect, it } from 'vitest';
import { PlatformError } from '../errors/platform-error';
import { RedisThrottlerGuard } from './redis-throttler.guard';

describe('RedisThrottlerGuard', () => {
  it('throws the stable rate-limit platform error instead of the default ThrottlerException', async () => {
    const guard = Object.create(
      RedisThrottlerGuard.prototype,
    ) as RedisThrottlerGuard;

    await expect(
      (
        guard as unknown as {
          throwThrottlingException(): Promise<void>;
        }
      ).throwThrottlingException(),
    ).rejects.toEqual(new PlatformError('RATE_LIMIT_EXCEEDED'));
  });
});
