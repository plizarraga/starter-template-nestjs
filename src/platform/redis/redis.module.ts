import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Environment } from '../config/environment';
import { REDIS_CLIENT } from './redis.client';
import { RedisService } from './redis.service';

@Global()
@Module({
  exports: [RedisService],
  providers: [
    {
      inject: [ConfigService],
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService<Environment, true>) => {
        const client = new Redis(config.getOrThrow('REDIS_URL'), {
          lazyConnect: true,
        });
        client.on('error', () => undefined);
        return client;
      },
    },
    RedisService,
  ],
})
export class RedisModule {}
