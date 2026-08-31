import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AccessControlModule } from './core/access-control/access-control.module';
import { OriginGuard } from './core/access-control/origin.guard';
import { RateLimitGuard } from './core/access-control/rate-limit.guard';
import { NotFoundFallbackModule } from './core/http/not-found-fallback.module';
import { PlatformModule } from './core/platform.module';
import { AuthModule } from './features/auth/auth.module';
import { RolesGuard } from './features/auth/guards/roles.guard';
import { SessionGuard } from './features/auth/session.guard';
import { UsersModule } from './features/users/users.module';

@Module({
  imports: [
    PlatformModule,
    AccessControlModule,
    AuthModule,
    UsersModule,
    // Must stay last: its catch-all route would otherwise shadow real routes
    // registered by the modules above.
    NotFoundFallbackModule,
  ],
  // Global guard chain. Registration order is the execution order and is
  // load-bearing: RolesGuard reads the principal SessionGuard puts on the
  // request, so it must run after it.
  providers: [
    { provide: APP_GUARD, useExisting: RateLimitGuard },
    { provide: APP_GUARD, useExisting: SessionGuard },
    { provide: APP_GUARD, useExisting: RolesGuard },
    { provide: APP_GUARD, useExisting: OriginGuard },
  ],
})
export class AppModule {}
