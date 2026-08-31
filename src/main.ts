import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { Environment } from './core/config/environment';
import { configureApplication } from './core/http/configure-application';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    bufferLogs: true,
  });
  app.enableShutdownHooks();
  await configureApplication(app);
  const config = app.get(ConfigService<Environment, true>);

  await app.listen(config.getOrThrow('PORT'));
}
void bootstrap();
