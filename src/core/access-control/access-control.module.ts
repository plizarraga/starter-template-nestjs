import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { Environment } from '../config/environment';
import { OriginGuard } from './origin.guard';
import { RateLimitGuard } from './rate-limit.guard';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      // Required so this object literal satisfies ThrottlerAsyncOptions'
      // weak-type check under @nestjs/common 12; no imports are actually needed.
      imports: [],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) => [
        {
          limit: config.getOrThrow<number>('RATE_LIMIT_MAX'),
          ttl: config.getOrThrow<number>('RATE_LIMIT_TTL_SECONDS') * 1000,
        },
      ],
    }),
  ],
  exports: [OriginGuard, RateLimitGuard],
  providers: [OriginGuard, RateLimitGuard],
})
export class AccessControlModule {}
