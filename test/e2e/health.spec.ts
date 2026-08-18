import { Test, TestingModule } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/platform/http/configure-application';
import { PrismaService } from '../../src/platform/prisma/prisma.service';
import { RedisService } from '../../src/platform/redis/redis.service';
import { PlatformError } from '../../src/platform/errors/platform-error';

describe('health endpoints (e2e)', () => {
  let app: NestExpressApplication;

  afterEach(async () => {
    await app?.close();
  });

  it('reports liveness without checking dependencies', async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ check: () => Promise.resolve() })
      .overrideProvider(RedisService)
      .useValue({ check: () => Promise.resolve() })
      .compile();
    app = moduleFixture.createNestApplication();
    configureApplication(app);
    await app.init();

    const response = await request(app.getHttpServer()).get('/health/live');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('reports ready only when PostgreSQL and Redis are available', async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ check: () => Promise.resolve() })
      .overrideProvider(RedisService)
      .useValue({ check: () => Promise.resolve() })
      .compile();
    app = moduleFixture.createNestApplication();
    configureApplication(app);
    await app.init();

    const response = await request(app.getHttpServer()).get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('returns a generic unavailable response when a required dependency fails', async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ check: () => Promise.resolve() })
      .overrideProvider(RedisService)
      .useValue({
        check: () => Promise.reject(new PlatformError('SERVICE_UNAVAILABLE')),
      })
      .compile();
    app = moduleFixture.createNestApplication();
    configureApplication(app);
    await app.init();

    const response = await request(app.getHttpServer()).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      message: 'Required service is unavailable',
    });
    expect(JSON.stringify(response.body)).not.toContain('redis');
  });
});
