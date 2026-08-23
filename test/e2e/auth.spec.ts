import { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configureApplication } from '../../src/platform/http/configure-application';
import { defaultEnvironment } from '../support/default-environment';
import {
  createTestEnvironment,
  TestEnvironment,
} from '../support/test-environment';

describe('Better Auth authentication (e2e)', () => {
  let app: NestExpressApplication;
  let environment: TestEnvironment;
  let originalEnvironment: NodeJS.ProcessEnv;

  beforeAll(async () => {
    originalEnvironment = { ...process.env };
    environment = await createTestEnvironment();
    const prisma = new PrismaClient({
      adapter: new PrismaPg(
        { connectionString: environment.databaseUrl },
        { schema: environment.schema },
      ),
    });
    await prisma.$executeRawUnsafe(
      `CREATE TYPE "${environment.schema}"."Role" AS ENUM ('USER', 'ADMIN')`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TABLE "${environment.schema}"."user" ("id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "email" TEXT NOT NULL UNIQUE, "emailVerified" BOOLEAN NOT NULL DEFAULT false, "image" TEXT, "role" "${environment.schema}"."Role" NOT NULL DEFAULT 'USER', "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ NOT NULL)`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TABLE "${environment.schema}"."session" ("id" TEXT PRIMARY KEY, "expiresAt" TIMESTAMPTZ NOT NULL, "token" TEXT NOT NULL UNIQUE, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ NOT NULL, "ipAddress" TEXT, "userAgent" TEXT, "userId" TEXT NOT NULL REFERENCES "${environment.schema}"."user"("id") ON DELETE CASCADE)`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TABLE "${environment.schema}"."account" ("id" TEXT PRIMARY KEY, "accountId" TEXT NOT NULL, "providerId" TEXT NOT NULL, "issuer" TEXT NOT NULL, "userId" TEXT NOT NULL REFERENCES "${environment.schema}"."user"("id") ON DELETE CASCADE, "accessToken" TEXT, "refreshToken" TEXT, "idToken" TEXT, "accessTokenExpiresAt" TIMESTAMPTZ, "refreshTokenExpiresAt" TIMESTAMPTZ, "scope" TEXT, "password" TEXT, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ NOT NULL, UNIQUE("issuer", "accountId"))`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TABLE "${environment.schema}"."verification" ("id" TEXT PRIMARY KEY, "identifier" TEXT NOT NULL, "value" TEXT NOT NULL, "expiresAt" TIMESTAMPTZ NOT NULL, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ NOT NULL)`,
    );
    await prisma.$disconnect();
    process.env = {
      ...originalEnvironment,
      ...defaultEnvironment,
      DATABASE_SCHEMA: environment.schema,
      DATABASE_URL: environment.databaseUrl,
    };
    const { AppModule } =
      (await import('../../src/app.module')) as typeof import('../../src/app.module');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureApplication(app);
    await app.init();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await environment?.stop();
    process.env = originalEnvironment;
  }, 120_000);

  it('When a browser signs up and signs in, then its session cookie authenticates the user API', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({
        name: 'Reader',
        email: 'reader@example.com',
        password: 'password-123',
      })
      .expect(200);
    const login = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email: 'reader@example.com', password: 'password-123' })
      .expect(200);
    const cookie = login.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toContain('HttpOnly');
    await request(app.getHttpServer())
      .get('/users/me')
      .set('Cookie', cookie)
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          email: 'reader@example.com',
          role: 'USER',
        }),
      );
  });

  it('When an active session reaches its renewal age, then a protected route renews its cookie', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({
        name: 'Returning reader',
        email: 'returning-reader@example.com',
        password: 'password-123',
      })
      .expect(200);
    const login = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({
        email: 'returning-reader@example.com',
        password: 'password-123',
      })
      .expect(200);
    const cookie = login.headers['set-cookie']?.[0] ?? '';
    const prisma = new PrismaClient({
      adapter: new PrismaPg(
        { connectionString: environment.databaseUrl },
        { schema: environment.schema },
      ),
    });
    await prisma.session.updateMany({
      data: { expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) },
    });

    const response = await request(app.getHttpServer())
      .get('/users/me')
      .set('Cookie', cookie)
      .expect(200);
    const renewedSession = await prisma.session.findFirst({
      where: { expiresAt: { gt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000) } },
    });
    await prisma.$disconnect();

    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('better-auth.session_token=')]),
    );
    expect(renewedSession).not.toBeNull();
  });
});
