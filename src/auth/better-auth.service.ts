import { prismaAdapter } from '@better-auth/prisma-adapter';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { betterAuth } from 'better-auth';
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node';
import type { Request, RequestHandler } from 'express';
import { Environment } from '../platform/config/environment';
import { PrismaService } from '../platform/prisma/prisma.service';

@Injectable()
export class BetterAuthService {
  private readonly instance;

  constructor(config: ConfigService<Environment, true>, prisma: PrismaService) {
    const origins = config
      .getOrThrow('CORS_ORIGINS')
      .split(',')
      .map((origin) => origin.trim());

    this.instance = betterAuth({
      database: prismaAdapter(prisma, { provider: 'postgresql' }),
      emailAndPassword: { enabled: true },
      logger: { disabled: true },
      rateLimit: {
        customRules: {
          '/sign-in/email': {
            max: config.getOrThrow('RATE_LIMIT_LOGIN_MAX'),
            window: config.getOrThrow('RATE_LIMIT_LOGIN_TTL_SECONDS'),
          },
          '/sign-up/email': {
            max: config.getOrThrow('RATE_LIMIT_REGISTER_MAX'),
            window: config.getOrThrow('RATE_LIMIT_REGISTER_TTL_SECONDS'),
          },
        },
      },
      session: {
        expiresIn: 7 * 24 * 60 * 60,
        updateAge: 24 * 60 * 60,
      },
      secret: config.getOrThrow('BETTER_AUTH_SECRET'),
      trustedOrigins: origins,
    });
  }

  handler(): RequestHandler {
    return toNodeHandler(this.instance);
  }

  getSession(request: Request) {
    return this.instance.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });
  }
}
