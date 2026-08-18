import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaClient, Role } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AccessTokenGuard,
  AuthenticatedRequest,
} from '../../src/auth/access-token.guard';
import { configureApplication } from '../../src/platform/http/configure-application';
import { defaultEnvironment } from '../support/default-environment';
import {
  createTestEnvironment,
  TestEnvironment,
} from '../support/test-environment';

@Controller('auth-probe')
class AuthProbeController {
  @Get()
  @UseGuards(AccessTokenGuard)
  principal(@Req() request: AuthenticatedRequest) {
    return request.principal;
  }
}

describe('authentication (e2e)', () => {
  let app: NestExpressApplication;
  let environment: TestEnvironment;
  let originalEnvironment: NodeJS.ProcessEnv;

  beforeAll(async () => {
    originalEnvironment = { ...process.env };
    environment = await createTestEnvironment();
    const databaseUrl = new URL(environment.databaseUrl);
    databaseUrl.searchParams.set('schema', environment.schema);
    const prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl.toString() } },
    });
    await prisma.$executeRawUnsafe(
      `CREATE TYPE "${environment.schema}"."Role" AS ENUM ('USER', 'ADMIN')`,
    );
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "${environment.schema}"."User" (
        "id" UUID NOT NULL,
        "email" TEXT NOT NULL,
        "passwordHash" TEXT NOT NULL,
        "role" "${environment.schema}"."Role" NOT NULL DEFAULT 'USER',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ NOT NULL,
        CONSTRAINT "User_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "User_email_key" UNIQUE ("email")
      )
    `);
    await prisma.$disconnect();

    process.env = {
      ...originalEnvironment,
      ...defaultEnvironment,
      DATABASE_URL: databaseUrl.toString(),
      REDIS_URL: environment.redisUrl,
    };
    const { AppModule } =
      (await import('../../src/app.module')) as typeof import('../../src/app.module');
    const { AuthModule } =
      (await import('../../src/auth/auth.module')) as typeof import('../../src/auth/auth.module');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthProbeController],
      imports: [AppModule, AuthModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApplication(app);
    await app.init();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await environment?.stop();
    process.env = originalEnvironment;
  }, 120_000);

  it('When a user registers and logs in, then the access token authenticates a protected request', async () => {
    const registration = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: ' Reader@Example.com ', password: 'password-123' })
      .expect(201);

    expect(registration.body).toMatchObject({
      email: 'reader@example.com',
      role: Role.USER,
    });
    expect(registration.body).not.toHaveProperty('passwordHash');

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'reader@example.com', password: 'password-123' })
      .expect(409)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'USER_EMAIL_ALREADY_EXISTS' });
      });

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'reader@example.com', password: 'password-123' })
      .expect(200);
    const loginBody = login.body as { accessToken: string };

    expect(login.body).toMatchObject({ expiresIn: 600, tokenType: 'Bearer' });

    const protectedResponse = await request(app.getHttpServer())
      .get('/auth-probe')
      .set('Authorization', `Bearer ${loginBody.accessToken}`)
      .expect(200);

    expect(protectedResponse.body).toMatchObject({ role: Role.USER });
  });

  it('When credentials are invalid, then login returns the stable invalid-credentials error', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'unknown@example.com', password: 'password-123' })
      .expect(401)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          code: 'INVALID_CREDENTIALS',
          path: '/auth/login',
          statusCode: 401,
        });
      });
  });
});
