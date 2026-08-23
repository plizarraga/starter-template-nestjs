import { forwardRef, Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { BetterAuthService } from './better-auth.service';
import { RolesGuard } from './guards/roles.guard';
import { SessionGuard } from './session.guard';

@Module({
  exports: [BetterAuthService, RolesGuard, SessionGuard],
  imports: [forwardRef(() => UsersModule)],
  providers: [BetterAuthService, RolesGuard, SessionGuard],
})
export class AuthModule {}
