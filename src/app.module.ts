import { Module } from '@nestjs/common';
import { AccessControlModule } from './access-control/access-control.module';
import { PlatformModule } from './platform/platform.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [PlatformModule, AccessControlModule, UsersModule],
})
export class AppModule {}
