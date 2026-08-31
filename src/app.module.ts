import { Module } from '@nestjs/common';
import { AccessControlModule } from './core/access-control/access-control.module';
import { NotFoundFallbackModule } from './core/http/not-found-fallback.module';
import { PlatformModule } from './core/platform.module';
import { UsersModule } from './features/users/users.module';

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
