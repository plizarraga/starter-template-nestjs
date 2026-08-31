import { Module } from '@nestjs/common';
import { AccessControlModule } from './access-control/access-control.module';
import { NotFoundFallbackModule } from './platform/http/not-found-fallback.module';
import { PlatformModule } from './platform/platform.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    PlatformModule,
    AccessControlModule,
    UsersModule,
    // Must stay last: its catch-all route would otherwise shadow real routes
    // registered by the modules above.
    NotFoundFallbackModule,
  ],
})
export class AppModule {}
