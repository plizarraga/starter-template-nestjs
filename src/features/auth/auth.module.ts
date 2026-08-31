import { Module } from '@nestjs/common';
import { BetterAuthService } from './better-auth.service';
import { SessionGuard } from './session.guard';

@Module({
  exports: [BetterAuthService, SessionGuard],
  providers: [BetterAuthService, SessionGuard],
})
export class AuthModule {}
