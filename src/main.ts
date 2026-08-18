import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { Environment } from './platform/config/environment';
import { configureApplication } from './platform/http/configure-application';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  configureApplication(app);
  const config = app.get(ConfigService<Environment, true>);

  await app.listen(config.getOrThrow('PORT'));
}
void bootstrap();
