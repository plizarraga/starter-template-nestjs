import { HttpStatus, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { BetterAuthService } from '../../auth/better-auth.service';
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
  app.use('/api/auth', app.get(BetterAuthService).handler());
  app.use(json());
  app.use(urlencoded({ extended: true }));
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
      new DocumentBuilder()
        .setTitle('Backend Starter API')
        .setDescription(
          'REST API for user authentication and administration. ' +
            'Access tokens are short-lived JWTs (600s by default) returned by ' +
            'POST /auth/login; refresh credentials travel in an httpOnly cookie ' +
            'scoped to /auth.',
        )
        .setVersion('1.0')
        .addTag('health', 'Liveness and readiness probes')
        .addTag('auth', 'Authentication and session management')
        .addTag('users', 'Profile and user administration (RBAC)')
        .addBearerAuth(
          {
            bearerFormat: 'JWT',
            description:
              'Short-lived access token returned by POST /auth/login. ' +
              'Paste the raw token (the Authorize dialog adds the "Bearer " prefix).',
            scheme: 'bearer',
            type: 'http',
          },
          'access-token',
        )
        .build(),
    );
    SwaggerModule.setup('docs', app, document);
  }
}
