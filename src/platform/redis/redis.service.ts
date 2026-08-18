import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { PlatformError } from '../errors/platform-error';
import { REDIS_CLIENT } from './redis.client';

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async check(): Promise<void> {
    try {
      await this.client.ping();
    } catch {
      throw new PlatformError('SERVICE_UNAVAILABLE');
    }
  }

  onModuleDestroy(): void {
    this.client.disconnect();
  }
}
