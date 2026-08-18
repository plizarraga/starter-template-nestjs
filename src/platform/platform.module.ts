import { Module } from '@nestjs/common';
import { PlatformConfigModule } from './config/platform-config.module';
import { PlatformLoggerModule } from './logging/platform-logger.module';

@Module({
  imports: [PlatformConfigModule, PlatformLoggerModule],
})
export class PlatformModule {}
