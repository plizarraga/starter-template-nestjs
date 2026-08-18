import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PlatformModule } from './platform/platform.module';

@Module({
  imports: [PlatformModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
