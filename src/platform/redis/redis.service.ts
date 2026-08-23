import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { PlatformError } from '../errors/platform-error';
import { REDIS_CLIENT } from './redis.client';

type RateLimitCommands = {
  incrementRateLimit(
    counterKey: string,
    ttlMilliseconds: number,
    limit: number,
  ): Promise<[number, number, number]>;
};

export type RateLimitResult = {
  isBlocked: boolean;
  timeToBlockExpire: number;
  timeToExpire: number;
  totalHits: number;
};

const incrementRateLimitLua = `
local totalHits = redis.call('INCR', KEYS[1])
if totalHits == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local timeToExpire = redis.call('PTTL', KEYS[1])
if timeToExpire < 0 then
  timeToExpire = tonumber(ARGV[1])
end
if totalHits > tonumber(ARGV[2]) then
  return {totalHits, timeToExpire, 1}
end
return {totalHits, timeToExpire, 0}
`;

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {
    this.client.defineCommand('incrementRateLimit', {
      lua: incrementRateLimitLua,
      numberOfKeys: 1,
    });
  }

  async incrementRateLimit(
    counterKey: string,
    ttlMilliseconds: number,
    limit: number,
  ): Promise<RateLimitResult> {
    try {
      await this.connectIfNeeded();
      const [totalHits, timeToExpireMs, blocked] = await (
        this.client as Redis & RateLimitCommands
      ).incrementRateLimit(`rate-limit:${counterKey}`, ttlMilliseconds, limit);
      const timeToExpire = Math.ceil(timeToExpireMs / 1000);
      return {
        isBlocked: blocked === 1,
        timeToBlockExpire: blocked === 1 ? timeToExpire : 0,
        timeToExpire,
        totalHits,
      };
    } catch {
      throw new PlatformError('SERVICE_UNAVAILABLE');
    }
  }

  async check(): Promise<void> {
    try {
      await this.connectIfNeeded();
      await this.client.ping();
    } catch {
      throw new PlatformError('SERVICE_UNAVAILABLE');
    }
  }

  private async connectIfNeeded(): Promise<void> {
    if (this.client.status === 'wait' || this.client.status === 'end') {
      await this.client.connect();
    }
  }

  onModuleDestroy(): void {
    this.client.disconnect();
  }
}
