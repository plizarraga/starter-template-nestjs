import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PlatformModule } from './platform/platform.module';

@Module({
  imports: [PlatformModule, AuthModule],
})
export class AppModule {}
