import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from '../auth/auth.module';
import { SessionGuard } from '../auth/session.guard';
import { RolesGuard } from '../authorization/guards/roles.guard';

@Module({
  imports: [AuthModule],
  providers: [
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AccessControlModule {}
