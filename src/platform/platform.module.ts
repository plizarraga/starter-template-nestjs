import { Global, Module } from '@nestjs/common';
import { PlatformConfigModule } from './config/platform-config.module';
import { HealthModule } from './health/health.module';
import { PlatformLoggerModule } from './logging/platform-logger.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { OriginValidator } from './http/origin-validator.service';

@Global()
@Module({
  imports: [
    PlatformConfigModule,
    PlatformLoggerModule,
    PrismaModule,
    RedisModule,
    HealthModule,
  ],
  exports: [OriginValidator],
  providers: [OriginValidator],
})
export class PlatformModule {}
