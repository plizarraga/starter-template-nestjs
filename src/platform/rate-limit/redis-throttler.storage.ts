import { Injectable } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { RateLimitResult, RedisService } from '../redis/redis.service';

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: RedisService) {}

  increment(
    key: string,
    ttl: number,
    limit: number,
    _blockDuration: number,
    throttlerName: string,
  ): Promise<RateLimitResult> {
    return this.redis.incrementRateLimit(`${throttlerName}:${key}`, ttl, limit);
  }
}
