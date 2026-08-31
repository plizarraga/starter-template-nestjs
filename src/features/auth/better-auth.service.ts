import { prismaAdapter } from '@better-auth/prisma-adapter';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { betterAuth } from 'better-auth';
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node';
import { openAPI } from 'better-auth/plugins';
import type { Request, RequestHandler, Response } from 'express';
import { Role } from '../../generated/prisma/client';
import { DeploymentTopology, Environment } from '../../core/config/environment';
import { PrismaService } from '../../core/prisma/prisma.service';

type CookieAttributes = {
  httpOnly: true;
  partitioned?: true;
  sameSite: 'lax' | 'none';
  secure: boolean;
};

export function deriveCookieAttributes(
  topology: DeploymentTopology,
  nodeEnv: Environment['NODE_ENV'],
): CookieAttributes {
  if (topology === 'cross-site') {
    return {
      httpOnly: true,
      partitioned: true,
      sameSite: 'none',
      secure: true,
    };
  }
  return { httpOnly: true, sameSite: 'lax', secure: nodeEnv === 'production' };
}

function createAuthInstance(
  config: ConfigService<Environment, true>,
  prisma: PrismaService,
) {
  const origins = config
    .getOrThrow<string>('CORS_ORIGINS')
    .split(',')
    .map((origin) => origin.trim());

  return betterAuth({
    advanced: {
      defaultCookieAttributes: deriveCookieAttributes(
        config.getOrThrow<DeploymentTopology>('DEPLOYMENT_TOPOLOGY'),
        config.getOrThrow<Environment['NODE_ENV']>('NODE_ENV'),
      ),
    },
    baseURL: config.getOrThrow<string>('PUBLIC_BASE_URL'),
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    emailAndPassword: { enabled: true },
    logger: { disabled: true },
    rateLimit: {
      customRules: {
        '/sign-in/email': {
          max: config.getOrThrow<number>('RATE_LIMIT_LOGIN_MAX'),
          window: config.getOrThrow<number>('RATE_LIMIT_LOGIN_TTL_SECONDS'),
        },
        '/sign-up/email': {
          max: config.getOrThrow<number>('RATE_LIMIT_REGISTER_MAX'),
          window: config.getOrThrow<number>('RATE_LIMIT_REGISTER_TTL_SECONDS'),
        },
      },
    },
    session: {
      cookieCache: { enabled: false },
      expiresIn: 7 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
    },
    secret: config.getOrThrow<string>('BETTER_AUTH_SECRET'),
    trustedOrigins: origins,
    plugins: [openAPI()],
    user: {
      additionalFields: {
        role: {
          type: Object.values(Role) as [string, ...string[]],
          required: false,
          defaultValue: Role.USER,
          input: false,
        },
      },
    },
  });
}

@Injectable()
export class BetterAuthService {
  private readonly instance: ReturnType<typeof createAuthInstance>;

  constructor(config: ConfigService<Environment, true>, prisma: PrismaService) {
    this.instance = createAuthInstance(config, prisma);
  }

  handler(): RequestHandler {
    return toNodeHandler(this.instance);
  }

  generateOpenApiSchema() {
    return this.instance.api.generateOpenAPISchema();
  }

  async getSession(request: Request, response: Response) {
    const result = await this.instance.api.getSession({
      headers: fromNodeHeaders(request.headers),
      returnHeaders: true,
    });
    const cookies = result.headers.getSetCookie();
    if (cookies.length > 0) {
      response.setHeader('set-cookie', cookies);
    }
    return result.response;
  }
}
