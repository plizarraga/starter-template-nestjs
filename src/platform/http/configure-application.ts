import { HttpStatus, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { Environment } from '../config/environment';
import { HttpExceptionFilter } from '../errors/http-exception.filter';
import { requestIdMiddleware } from '../request-id/request-id.middleware';

export function configureApplication(app: NestExpressApplication): void {
  const config = app.get(ConfigService<Environment, true>);
  const origins = config
    .getOrThrow<string>('CORS_ORIGINS')
    .split(',')
    .map((origin) => origin.trim());

  app.set('trust proxy', 1);
  app.use(requestIdMiddleware);
  app.use(helmet());
  app.enableCors({ credentials: true, origin: origins });
  app.useGlobalPipes(
    new ValidationPipe({
      errorHttpStatusCode: HttpStatus.BAD_REQUEST,
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter(app.get<Logger>(Logger)));

  if (config.getOrThrow('NODE_ENV') !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('Backend Starter API').build(),
    );
    SwaggerModule.setup('docs', app, document);
  }
}
