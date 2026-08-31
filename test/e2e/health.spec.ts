import { Test, TestingModule } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../src/app.module';
import { API_VERSIONED_PREFIX } from '../../src/core/http/api-version';
import { configureApplication } from '../../src/core/http/configure-application';
import { PrismaService } from '../../src/core/prisma/prisma.service';

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
      .compile();
    app = moduleFixture.createNestApplication();
    await configureApplication(app);
    await app.init();

    const response = await request(app.getHttpServer()).get(
      `${API_VERSIONED_PREFIX}/health/live`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('reports ready when PostgreSQL is available', async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ check: () => Promise.resolve() })
      .compile();
    app = moduleFixture.createNestApplication();
    await configureApplication(app);
    await app.init();

    const response = await request(app.getHttpServer()).get(
      `${API_VERSIONED_PREFIX}/health/ready`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      checks: { postgres: 'up' },
    });
  });

  it('reports the failing dependency without leaking connection details', async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        check: () =>
          Promise.reject(new Error('connect ECONNREFUSED 10.0.0.4:5432')),
      })
      .compile();
    app = moduleFixture.createNestApplication();
    await configureApplication(app);
    await app.init();

    const response = await request(app.getHttpServer()).get(
      `${API_VERSIONED_PREFIX}/health/ready`,
    );

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      status: 'error',
      checks: { postgres: 'down' },
    });
    expect(JSON.stringify(response.body)).not.toContain('10.0.0.4');
    expect(JSON.stringify(response.body)).not.toContain('5432');
    expect(JSON.stringify(response.body)).not.toContain('ECONNREFUSED');
  });
});
