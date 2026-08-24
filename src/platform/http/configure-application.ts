import { HttpStatus, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { BetterAuthService } from '../../auth/better-auth.service';
import { Logger } from 'nestjs-pino';
import { Environment } from '../config/environment';
import { HttpExceptionFilter } from '../errors/http-exception.filter';
import { requestIdMiddleware } from '../request-id/request-id.middleware';

export async function configureApplication(
  app: NestExpressApplication,
): Promise<void> {
  const config = app.get(ConfigService<Environment, true>);
  const origins = config
    .getOrThrow<string>('CORS_ORIGINS')
    .split(',')
    .map((origin) => origin.trim());

  app.set('trust proxy', 1);
  app.use(requestIdMiddleware);
  app.use(helmet());
  const authService = app.get(BetterAuthService);
  app.use('/api/auth', authService.handler());
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

    const documentedAuthPaths = new Set([
      '/sign-up/email',
      '/sign-in/email',
      '/sign-out',
      '/get-session',
    ]);
    const authSchema = await authService.generateOpenApiSchema();
    for (const [path, item] of Object.entries(authSchema.paths ?? {})) {
      if (!documentedAuthPaths.has(path)) {
        continue;
      }
      for (const operation of Object.values(
        item as Record<string, { tags?: string[] }>,
      )) {
        operation.tags = ['auth'];
      }
      document.paths[`/api/auth${path}`] =
        item as OpenAPIObject['paths'][string];
    }
    Object.assign(
      document.components?.schemas ?? {},
      authSchema.components?.schemas,
    );

    SwaggerModule.setup('docs', app, document);
  }
}
