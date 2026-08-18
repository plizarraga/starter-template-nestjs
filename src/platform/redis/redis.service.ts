import { ConfigService } from '@nestjs/config';
import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { Environment } from '../config/environment';
import { PlatformError } from '../errors/platform-error';
import { REDIS_CLIENT } from './redis.client';

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(
    @Inject(REDIS_CLIENT) private readonly client: Redis,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  async createAuthenticationSession(
    userId: string,
    sessionId: string,
  ): Promise<void> {
    const ttlSeconds = this.config.getOrThrow('REFRESH_TOKEN_TTL_DAYS') * 86400;
    const sessionKey = `auth:session:${sessionId}`;

    try {
      if (this.client.status === 'wait' || this.client.status === 'end') {
        await this.client.connect();
      }
      const results = await this.client
        .multi()
        .hset(
          sessionKey,
          'createdAt',
          new Date().toISOString(),
          'userId',
          userId,
        )
        .expire(sessionKey, ttlSeconds)
        .sadd(`auth:user-sessions:${userId}`, sessionId)
        .exec();
      if (results === null || results.some(([error]) => error != null)) {
        throw new Error('Redis session transaction failed');
      }
    } catch {
      throw new PlatformError('SERVICE_UNAVAILABLE');
    }
  }

  async check(): Promise<void> {
    try {
      if (this.client.status === 'wait' || this.client.status === 'end') {
        await this.client.connect();
      }
      await this.client.ping();
    } catch {
      throw new PlatformError('SERVICE_UNAVAILABLE');
    }
  }

  onModuleDestroy(): void {
    this.client.disconnect();
  }
}
