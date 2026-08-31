import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from '../../features/auth/auth.module';
import { SessionGuard } from '../../features/auth/session.guard';
import { RolesGuard } from '../../features/auth/guards/roles.guard';
import { Environment } from '../config/environment';
import { OriginGuard } from './origin.guard';
import { RateLimitGuard } from './rate-limit.guard';

@Module({
  imports: [
    AuthModule,
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
  providers: [
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useExisting: SessionGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: OriginGuard },
  ],
})
export class AccessControlModule {}
