import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { BetterAuthService } from './better-auth.service';
import { SessionGuard } from './session.guard';

@Module({
  exports: [BetterAuthService, SessionGuard, UsersModule],
  imports: [UsersModule],
  providers: [BetterAuthService, SessionGuard],
})
export class AuthModule {}
