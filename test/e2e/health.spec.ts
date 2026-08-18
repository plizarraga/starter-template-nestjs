import { Test, TestingModule } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/platform/http/configure-application';
import { PrismaService } from '../../src/platform/prisma/prisma.service';
import { RedisService } from '../../src/platform/redis/redis.service';

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

  it('reports ready when PostgreSQL and Redis are available', async () => {
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
    expect(response.body).toEqual({
      status: 'ok',
      checks: { postgres: 'up', redis: 'up' },
    });
  });

  it('reports the failing dependency without leaking connection details', async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ check: () => Promise.resolve() })
      .overrideProvider(RedisService)
      .useValue({
        check: () =>
          Promise.reject(new Error('connect ECONNREFUSED 10.0.0.5:6379')),
      })
      .compile();
    app = moduleFixture.createNestApplication();
    configureApplication(app);
    await app.init();

    const response = await request(app.getHttpServer()).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      status: 'error',
      checks: { postgres: 'up', redis: 'down' },
    });
    expect(JSON.stringify(response.body)).not.toContain('10.0.0.5');
    expect(JSON.stringify(response.body)).not.toContain('ECONNREFUSED');
  });

  it('reports PostgreSQL down while Redis stays up', async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        check: () =>
          Promise.reject(new Error('connect ECONNREFUSED 10.0.0.4:5432')),
      })
      .overrideProvider(RedisService)
      .useValue({ check: () => Promise.resolve() })
      .compile();
    app = moduleFixture.createNestApplication();
    configureApplication(app);
    await app.init();

    const response = await request(app.getHttpServer()).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      status: 'error',
      checks: { postgres: 'down', redis: 'up' },
    });
    expect(JSON.stringify(response.body)).not.toContain('10.0.0.4');
    expect(JSON.stringify(response.body)).not.toContain('5432');
    expect(JSON.stringify(response.body)).not.toContain('ECONNREFUSED');
  });

  it('reports both dependencies down', async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ check: () => Promise.reject(new Error('down')) })
      .overrideProvider(RedisService)
      .useValue({ check: () => Promise.reject(new Error('down')) })
      .compile();
    app = moduleFixture.createNestApplication();
    configureApplication(app);
    await app.init();

    const response = await request(app.getHttpServer()).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      status: 'error',
      checks: { postgres: 'down', redis: 'down' },
    });
  });
});
