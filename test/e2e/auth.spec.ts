import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '../../src/generated/prisma/client';
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
    const prisma = new PrismaClient({
      adapter: new PrismaPg(
        { connectionString: environment.databaseUrl },
        { schema: environment.schema },
      ),
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
      DATABASE_SCHEMA: environment.schema,
      DATABASE_URL: environment.databaseUrl,
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

  it('When registration includes a role field, then it is rejected instead of being honored', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'privilege-attempt@example.com',
        password: 'password-123',
        role: 'ADMIN',
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'VALIDATION_ERROR' });
      });

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'privilege-attempt@example.com',
        password: 'password-123',
      })
      .expect(401);
  });

  it('When a refresh session has been revoked, then the still-valid access token continues to authenticate normal requests', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'stateless-session@example.com',
        password: 'password-123',
      })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'stateless-session@example.com',
        password: 'password-123',
      })
      .expect(200);
    const accessToken = (login.body as { accessToken: string }).accessToken;

    await request(app.getHttpServer())
      .post('/auth/logout-all')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get('/auth-probe')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });

  it('When the underlying user record no longer exists, then the still-valid access token continues to authenticate normal requests', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'stateless-user@example.com', password: 'password-123' })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'stateless-user@example.com', password: 'password-123' })
      .expect(200);
    const accessToken = (login.body as { accessToken: string }).accessToken;

    const adapter = new PrismaPg(
      { connectionString: environment.databaseUrl },
      { schema: environment.schema },
    );
    const prisma = new PrismaClient({ adapter });
    await prisma.user.delete({
      where: { email: 'stateless-user@example.com' },
    });
    await prisma.$disconnect();

    await request(app.getHttpServer())
      .get('/auth-probe')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
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

  it('When a refresh cookie is used, then it rotates once and rejects reuse', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'refresh@example.com', password: 'password-123' })
      .expect(201);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'refresh@example.com', password: 'password-123' })
      .expect(200);
    const originalCookie = login.headers['set-cookie']?.[0];
    expect(originalCookie).toContain('refresh_token=');
    expect(originalCookie).toContain('HttpOnly');
    expect(originalCookie).toContain('Path=/auth');

    const refresh = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', originalCookie ?? '')
      .set('Origin', 'http://localhost:3001')
      .expect(200);
    const replacementCookie = refresh.headers['set-cookie']?.[0];
    expect(refresh.body).toMatchObject({ expiresIn: 600, tokenType: 'Bearer' });
    expect(replacementCookie).toContain('refresh_token=');
    expect(replacementCookie).not.toEqual(originalCookie);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', originalCookie ?? '')
      .set('Origin', 'http://localhost:3001')
      .expect(401)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
      });
  });

  it('When refresh is concurrent, then exactly one request succeeds', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'concurrent@example.com', password: 'password-123' })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'concurrent@example.com', password: 'password-123' })
      .expect(200);
    const cookie = login.headers['set-cookie']?.[0] ?? '';

    const responses = await Promise.all([
      request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookie)
        .set('Origin', 'http://localhost:3001'),
      request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookie)
        .set('Origin', 'http://localhost:3001'),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 401,
    ]);
  });

  it('When a refresh request has an untrusted origin, then it is rejected before consuming the session', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Origin', 'https://untrusted.example.com')
      .expect(403)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'FORBIDDEN' });
      });
  });

  it('When a user logs out, then the cookie is cleared and its session cannot refresh', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'logout@example.com', password: 'password-123' })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'logout@example.com', password: 'password-123' })
      .expect(200);
    const cookie = login.headers['set-cookie']?.[0] ?? '';

    const logout = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', cookie)
      .set('Origin', 'http://localhost:3001')
      .expect(204);
    expect(logout.headers['set-cookie']?.[0]).toContain('refresh_token=;');

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', cookie)
      .set('Origin', 'http://localhost:3001')
      .expect(401);
  });

  it('When a user logs out all sessions, then every refresh session is revoked', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'logout-all@example.com', password: 'password-123' })
      .expect(201);
    const firstLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'logout-all@example.com', password: 'password-123' })
      .expect(200);
    const secondLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'logout-all@example.com', password: 'password-123' })
      .expect(200);
    const accessToken = (firstLogin.body as { accessToken: string })
      .accessToken;

    await request(app.getHttpServer())
      .post('/auth/logout-all')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    for (const cookie of [
      firstLogin.headers['set-cookie']?.[0] ?? '',
      secondLogin.headers['set-cookie']?.[0] ?? '',
    ]) {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookie)
        .set('Origin', 'http://localhost:3001')
        .expect(401);
    }
  });

  it('When an authenticated user retrieves and updates their profile, then only the public normalized profile is returned', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'profile@example.com', password: 'password-123' })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'profile@example.com', password: 'password-123' })
      .expect(200);
    const accessToken = (login.body as { accessToken: string }).accessToken;
    const refreshCookie = login.headers['set-cookie']?.[0] ?? '';

    await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          email: 'profile@example.com',
          role: Role.USER,
        });
        expect(body).not.toHaveProperty('passwordHash');
      });

    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'password-123',
        email: ' Profile-Updated@Example.com ',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ email: 'profile-updated@example.com' });
        expect(body).not.toHaveProperty('passwordHash');
      });

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', refreshCookie)
      .set('Origin', 'http://localhost:3001')
      .expect(401);
  });

  it('When an authenticated user changes their password, then existing refresh sessions are revoked', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'password@example.com', password: 'password-123' })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'password@example.com', password: 'password-123' })
      .expect(200);
    const accessToken = (login.body as { accessToken: string }).accessToken;
    const refreshCookie = login.headers['set-cookie']?.[0] ?? '';

    await request(app.getHttpServer())
      .patch('/auth/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'password-123',
        newPassword: 'password-456',
      })
      .expect(204);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', refreshCookie)
      .set('Origin', 'http://localhost:3001')
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'password@example.com', password: 'password-456' })
      .expect(200);
  });

  it('When a profile update has an invalid password or duplicate email, then it returns the standard error', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'existing@example.com', password: 'password-123' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'updater@example.com', password: 'password-123' })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'updater@example.com', password: 'password-123' })
      .expect(200);
    const accessToken = (login.body as { accessToken: string }).accessToken;

    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'wrong-password', email: 'updated@example.com' })
      .expect(401)
      .expect(({ body }) => {
        const error = body as Record<string, unknown>;
        expect(error).toMatchObject({
          code: 'INVALID_CREDENTIALS',
          message: 'Credentials are invalid',
          path: '/users/me',
          statusCode: 401,
        });
        expect(error.requestId).toEqual(expect.any(String));
        expect(error.timestamp).toEqual(expect.any(String));
      });

    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'password-123', email: 'existing@example.com' })
      .expect(409)
      .expect(({ body }) => {
        const error = body as Record<string, unknown>;
        expect(error).toMatchObject({
          code: 'USER_EMAIL_ALREADY_EXISTS',
          message: 'A user with this email already exists',
          path: '/users/me',
          statusCode: 409,
        });
        expect(error.requestId).toEqual(expect.any(String));
        expect(error.timestamp).toEqual(expect.any(String));
      });
  });
});
