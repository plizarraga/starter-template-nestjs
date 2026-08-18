import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Prisma, Role, User } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../src/app.module';
import {
  AccessTokenGuard,
  AuthenticatedRequest,
} from '../../src/auth/access-token.guard';
import { AuthModule } from '../../src/auth/auth.module';
import { configureApplication } from '../../src/platform/http/configure-application';
import { PrismaService } from '../../src/platform/prisma/prisma.service';
import { REDIS_CLIENT } from '../../src/platform/redis/redis.client';

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

  afterEach(async () => {
    await app?.close();
  });

  it('When a user registers and logs in, then the access token authenticates a protected request', async () => {
    const users = new Map<string, User>();
    const redisTransaction = {
      exec: vi.fn().mockResolvedValue([]),
      expire: vi.fn().mockReturnThis(),
      hset: vi.fn().mockReturnThis(),
      sadd: vi.fn().mockReturnThis(),
    };
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthProbeController],
      imports: [AppModule, AuthModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        user: {
          create: vi.fn(
            ({
              data,
            }: {
              data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>;
            }) => {
              if (users.has(data.email)) {
                throw new Prisma.PrismaClientKnownRequestError('Duplicate', {
                  clientVersion: 'test',
                  code: 'P2002',
                });
              }
              const user = {
                ...data,
                createdAt: new Date('2026-08-17T00:00:00.000Z'),
                id: 'user-1',
                updatedAt: new Date('2026-08-17T00:00:00.000Z'),
              };
              users.set(user.email, user);
              return user;
            },
          ),
          findUnique: vi.fn(
            ({ where: { email } }: { where: { email: string } }) =>
              Promise.resolve(users.get(email) ?? null),
          ),
        },
      })
      .overrideProvider(REDIS_CLIENT)
      .useValue({ disconnect: vi.fn(), multi: vi.fn(() => redisTransaction) })
      .compile();
    app = moduleFixture.createNestApplication();
    configureApplication(app);
    await app.init();

    const registration = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: ' Reader@Example.com ', password: 'password-123' })
      .expect(201);

    expect(registration.body).toMatchObject({
      email: 'reader@example.com',
      id: 'user-1',
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
    expect(redisTransaction.exec).toHaveBeenCalledOnce();

    const protectedResponse = await request(app.getHttpServer())
      .get('/auth-probe')
      .set('Authorization', `Bearer ${loginBody.accessToken}`)
      .expect(200);

    expect(protectedResponse.body).toEqual({ id: 'user-1', role: Role.USER });
  });

  it('When credentials are invalid, then login returns the stable invalid-credentials error', async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ user: { findUnique: vi.fn().mockResolvedValue(null) } })
      .compile();
    app = moduleFixture.createNestApplication();
    configureApplication(app);
    await app.init();

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
