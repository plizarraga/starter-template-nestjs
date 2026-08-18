import { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaClient } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configureApplication } from '../../src/platform/http/configure-application';
import { defaultEnvironment } from '../support/default-environment';
import {
  createTestEnvironment,
  TestEnvironment,
} from '../support/test-environment';

describe('Redis-backed rate limits (e2e)', () => {
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
      RATE_LIMIT_LOGIN_MAX: '2',
      RATE_LIMIT_LOGIN_TTL_SECONDS: '900',
      RATE_LIMIT_REFRESH_MAX: '2',
      RATE_LIMIT_REFRESH_TTL_SECONDS: '900',
      RATE_LIMIT_REGISTER_MAX: '2',
      RATE_LIMIT_REGISTER_TTL_SECONDS: '3600',
      REDIS_URL: environment.redisUrl,
    };
    const { AppModule } =
      (await import('../../src/app.module')) as typeof import('../../src/app.module');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
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

  it('When a route is called more than its configured limit, then further requests are rejected with the stable rate-limit error', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'first@example.com', password: 'password-123' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'second@example.com', password: 'password-123' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'third@example.com', password: 'password-123' })
      .expect(429)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          code: 'RATE_LIMIT_EXCEEDED',
          path: '/auth/register',
          statusCode: 429,
        });
      });
  });

  it('When one route is rate-limited, then an unrelated route keeps its own independent counter', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'isolation@example.com', password: 'password-123' })
      .expect(429);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'password-123' })
      .expect(401)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'INVALID_CREDENTIALS' });
      });
  });

  it('When login is called more than its configured limit, then it is independently rate-limited', async () => {
    // The previous test already spent one of this route's two-request
    // budget, so only one more call is allowed before it is blocked.
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrong-password' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrong-password' })
      .expect(429)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          code: 'RATE_LIMIT_EXCEEDED',
          path: '/auth/login',
          statusCode: 429,
        });
      });
  });

  it('When refresh is called more than its configured limit, then it is independently rate-limited', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Origin', 'http://localhost:3001')
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Origin', 'http://localhost:3001')
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Origin', 'http://localhost:3001')
      .expect(429)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          code: 'RATE_LIMIT_EXCEEDED',
          path: '/auth/refresh',
          statusCode: 429,
        });
      });
  });
});
