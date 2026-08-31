import { HttpStatus, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { Logger } from 'nestjs-pino';
import { Environment } from '../config/environment';
import { HttpExceptionFilter } from '../errors/http-exception.filter';
import { requestIdMiddleware } from '../request-id/request-id.middleware';
import {
  API_DEFAULT_VERSION,
  API_GLOBAL_PREFIX,
  API_VERSION_PREFIX,
} from './api-version';
import { HTTP_EXTENSION, type HttpExtension } from './http-extension';

export async function configureApplication(
  app: NestExpressApplication,
): Promise<void> {
  const config = app.get(ConfigService<Environment, true>);
  const origins = config
    .getOrThrow<string>('CORS_ORIGINS')
    .split(',')
    .map((origin) => origin.trim());

  app.set('trust proxy', config.getOrThrow<number>('TRUST_PROXY_HOPS'));
  app.use(requestIdMiddleware);
  app.use(helmet());
  const httpExtension = app.get<HttpExtension>(HTTP_EXTENSION, {
    strict: false,
  });
  app.use(httpExtension.basePath, httpExtension.handler());
  app.use(json());
  app.use(urlencoded({ extended: true }));
  app.enableCors({ credentials: true, origin: origins });
  app.setGlobalPrefix(API_GLOBAL_PREFIX);
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: API_DEFAULT_VERSION,
    prefix: API_VERSION_PREFIX,
  });
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
      new DocumentBuilder()
        .setTitle('Backend Starter API')
        .setDescription(
          'User administration API protected by Better Auth session cookies. ' +
            'Native authentication routes are mounted at /api/auth.',
        )
        .setVersion('1.0')
        .addCookieAuth('better-auth.session_token')
        .addTag('health', 'Liveness and readiness probes')
        .addTag('auth', 'Native Better Auth authentication')
        .addTag('users', 'Profile and user administration (RBAC)')
        .build(),
    );

    await httpExtension.contributeOpenApiDocument(document);

    SwaggerModule.setup('docs', app, document);
  }
}
