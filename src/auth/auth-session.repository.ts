import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { Environment } from '../platform/config/environment';
import { PlatformError } from '../platform/errors/platform-error';
import { REDIS_CLIENT } from '../platform/redis/redis.client';

@Injectable()
export class AuthSessionRepository {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  async create(userId: string): Promise<string> {
    const sessionId = randomUUID();
    const ttlSeconds = this.config.getOrThrow('REFRESH_TOKEN_TTL_DAYS') * 86400;
    const sessionKey = `auth:session:${sessionId}`;

    try {
      await this.redis
        .multi()
        .hset(sessionKey, {
          createdAt: new Date().toISOString(),
          userId,
        })
        .expire(sessionKey, ttlSeconds)
        .sadd(`auth:user-sessions:${userId}`, sessionId)
        .exec();
    } catch {
      throw new PlatformError('SERVICE_UNAVAILABLE');
    }

    return sessionId;
  }
}
