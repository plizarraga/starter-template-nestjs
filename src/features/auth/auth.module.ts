import { Module } from '@nestjs/common';
import { HTTP_EXTENSION } from '../../core/http/http-extension';
import { BetterAuthService } from './better-auth.service';
import { RolesGuard } from './guards/roles.guard';
import { SessionGuard } from './session.guard';

@Module({
  exports: [BetterAuthService, RolesGuard, SessionGuard],
  providers: [
    BetterAuthService,
    RolesGuard,
    SessionGuard,
    // Mounts the native Better Auth routes into the request pipeline without
    // core/http having to know this feature exists.
    { provide: HTTP_EXTENSION, useExisting: BetterAuthService },
  ],
})
export class AuthModule {}
