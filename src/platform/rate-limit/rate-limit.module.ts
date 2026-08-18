import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { seconds, ThrottlerModule } from '@nestjs/throttler';
import { Environment } from '../config/environment';
import { RedisModule } from '../redis/redis.module';
import { RedisService } from '../redis/redis.service';
import { RATE_LIMIT_NAMES } from './rate-limit-names';
import { RedisThrottlerGuard } from './redis-throttler.guard';
import { RedisThrottlerStorage } from './redis-throttler.storage';

@Global()
@Module({
  exports: [RedisThrottlerGuard],
  imports: [
    RedisModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService, RedisService],
      useFactory: (
        config: ConfigService<Environment, true>,
        redis: RedisService,
      ) => ({
        storage: new RedisThrottlerStorage(redis),
        throttlers: [
          {
            limit: config.getOrThrow('RATE_LIMIT_REGISTER_MAX'),
            name: RATE_LIMIT_NAMES.REGISTER,
            ttl: seconds(config.getOrThrow('RATE_LIMIT_REGISTER_TTL_SECONDS')),
          },
          {
            limit: config.getOrThrow('RATE_LIMIT_LOGIN_MAX'),
            name: RATE_LIMIT_NAMES.LOGIN,
            ttl: seconds(config.getOrThrow('RATE_LIMIT_LOGIN_TTL_SECONDS')),
          },
          {
            limit: config.getOrThrow('RATE_LIMIT_REFRESH_MAX'),
            name: RATE_LIMIT_NAMES.REFRESH,
            ttl: seconds(config.getOrThrow('RATE_LIMIT_REFRESH_TTL_SECONDS')),
          },
        ],
      }),
    }),
  ],
  providers: [RedisThrottlerGuard],
})
export class RateLimitModule {}
