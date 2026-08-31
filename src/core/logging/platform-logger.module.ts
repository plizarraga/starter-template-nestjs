import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { RequestWithId } from '../request-id/request-id.middleware';

const redactedPaths = [
  'accessToken',
  'authorization',
  'BETTER_AUTH_SECRET',
  'cookie',
  'currentPassword',
  'DATABASE_URL',
  'password',
  'newPassword',
  'req.body.accessToken',
  'req.body.currentPassword',
  'req.body.newPassword',
  'req.body.password',
  'req.body.refreshToken',
  'req.body.token',
  'req.headers.authorization',
  'req.headers.cookie',
  '*.accessToken',
  '*.currentPassword',
  '*.newPassword',
  '*.password',
  '*.token',
];

export const pinoRedaction = {
  censor: '[Redacted]',
  paths: redactedPaths,
};

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        customProps: (request) => ({
          requestId: (request as RequestWithId).requestId,
        }),
        level: process.env.LOG_LEVEL ?? 'info',
        redact: pinoRedaction,
      },
    }),
  ],
})
export class PlatformLoggerModule {}
