import { Body, Controller, Get, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { OpenAPIObject } from '@nestjs/swagger';
import request from 'supertest';
import { IsEmail } from 'class-validator';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../src/app.module';
import { Public } from '../../src/auth/decorators/public.decorator';
import {
  Environment,
  validateEnvironment,
} from '../../src/platform/config/environment';
import { API_VERSIONED_PREFIX } from '../../src/platform/http/api-version';
import { configureApplication } from '../../src/platform/http/configure-application';
import { defaultEnvironment } from '../support/default-environment';

class ValidationProbeDto {
  @IsEmail()
  email!: string;
}

type StandardError = {
  code: string;
  path: string;
  requestId: string;
  statusCode: number;
};

function createConfig(
  overrides: Partial<NodeJS.ProcessEnv> = {},
): ConfigService<Environment, true> {
  return new ConfigService<Environment, true>(
    validateEnvironment({ ...defaultEnvironment, ...overrides }),
  );
}

async function createApplication(
  config: ConfigService<Environment, true>,
): Promise<NestExpressApplication> {
  const moduleFixture = await Test.createTestingModule({
    controllers: [
      RateLimitProbeController,
      RateLimitProtectedProbeController,
      ValidationProbeController,
    ],
    imports: [AppModule],
  })
    .overrideProvider(ConfigService)
    .useValue(config)
    .compile();
  const app = moduleFixture.createNestApplication();
  await configureApplication(app);
  await app.init();
  return app;
}

@Public()
@Controller('validation-probe')
class ValidationProbeController {
  @Get()
  read(): { status: string } {
    return { status: 'ok' };
  }

  @Post()
  create(@Body() body: ValidationProbeDto): ValidationProbeDto {
    return body;
  }
}

@Public()
@Controller('rate-limit-probe')
class RateLimitProbeController {
  @Get()
  read(): { status: string } {
    return { status: 'ok' };
  }
}

@Controller('rate-limit-protected-probe')
class RateLimitProtectedProbeController {
  @Get()
  read(): { status: string } {
    return { status: 'ok' };
  }
}

@Public()
@Controller('failure-probe')
class FailureProbeController {
  @Get()
  fail(): never {
    throw new Error(
      'connect ECONNREFUSED 127.0.0.1:5432 - password authentication failed for user "postgres"',
    );
  }
}

describe('HTTP platform (e2e)', () => {
  let app: NestExpressApplication;
  const originalEnvironment = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...originalEnvironment,
      ...defaultEnvironment,
    };
  });

  afterEach(async () => {
    await app?.close();
    process.env = originalEnvironment;
  });

  it('When an unknown route is requested, then it returns the standard error with a generated request ID', async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await configureApplication(app);
    await app.init();

    const response = await request(app.getHttpServer())
      .get(`${API_VERSIONED_PREFIX}/missing`)
      .expect(404);
    const error = response.body as StandardError;

    expect(response.headers['x-request-id']).toBe(error.requestId);
    expect(error).toMatchObject({
      code: 'NOT_FOUND',
      path: `${API_VERSIONED_PREFIX}/missing`,
      statusCode: 404,
    });
  });

  it('When a trusted request ID is supplied, then it is propagated to the response and error', async () => {
    const requestId = 'upstream-request-42';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await configureApplication(app);
    await app.init();

    const response = await request(app.getHttpServer())
      .get(`${API_VERSIONED_PREFIX}/missing`)
      .set('X-Request-Id', requestId)
      .expect(404);
    const error = response.body as StandardError;

    expect(response.headers['x-request-id']).toBe(requestId);
    expect(error.requestId).toBe(requestId);
  });

  it('When the application is initialized, then it applies secure headers and the configured CORS origin', async () => {
    const origin = 'http://localhost:3001';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await configureApplication(app);
    await app.init();

    const response = await request(app.getHttpServer())
      .get(`${API_VERSIONED_PREFIX}/health/live`)
      .set('Origin', origin)
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBe(origin);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('When a request includes an unknown property, then validation rejects it with the standard error contract', async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ValidationProbeController],
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await configureApplication(app);
    await app.init();

    const response = await request(app.getHttpServer())
      .post(`${API_VERSIONED_PREFIX}/validation-probe`)
      .send({ email: 'reader@example.com', role: 'ADMIN' })
      .expect(400);
    const error = response.body as StandardError;

    expect(error).toMatchObject({
      code: 'VALIDATION_ERROR',
      path: `${API_VERSIONED_PREFIX}/validation-probe`,
      statusCode: 400,
    });
  });

  it('When a cross-site state-changing request has no trusted origin, then any starter-owned route rejects it', async () => {
    app = await createApplication(
      createConfig({
        DEPLOYMENT_TOPOLOGY: 'cross-site',
        PUBLIC_BASE_URL: 'https://api.example.com',
      }),
    );

    const response = await request(app.getHttpServer())
      .post(`${API_VERSIONED_PREFIX}/validation-probe`)
      .send({ email: 'reader@example.com' })
      .expect(403);

    expect(response.body).toMatchObject({
      code: 'FORBIDDEN',
      path: `${API_VERSIONED_PREFIX}/validation-probe`,
      statusCode: 403,
    });
  });

  it('When a cross-site state-changing request has a trusted origin, then any starter-owned route accepts it', async () => {
    app = await createApplication(
      createConfig({
        DEPLOYMENT_TOPOLOGY: 'cross-site',
        PUBLIC_BASE_URL: 'https://api.example.com',
      }),
    );

    await request(app.getHttpServer())
      .post(`${API_VERSIONED_PREFIX}/validation-probe`)
      .set('Origin', 'http://localhost:3001')
      .send({ email: 'reader@example.com' })
      .expect(201);
  });

  it('When a same-site state-changing request has no origin, then any starter-owned route accepts it', async () => {
    app = await createApplication(createConfig());

    await request(app.getHttpServer())
      .post(`${API_VERSIONED_PREFIX}/validation-probe`)
      .send({ email: 'reader@example.com' })
      .expect(201);
  });

  it('When a starter-owned route exceeds its limit, then it is rejected', async () => {
    app = await createApplication(
      createConfig({ RATE_LIMIT_MAX: '2', RATE_LIMIT_TTL_SECONDS: '60' }),
    );

    await request(app.getHttpServer())
      .get(`${API_VERSIONED_PREFIX}/rate-limit-probe`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`${API_VERSIONED_PREFIX}/rate-limit-probe`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`${API_VERSIONED_PREFIX}/rate-limit-probe`)
      .expect(429);
  });

  it('When an anonymous protected route exceeds its limit, then it is rejected before session authorization', async () => {
    app = await createApplication(
      createConfig({ RATE_LIMIT_MAX: '2', RATE_LIMIT_TTL_SECONDS: '60' }),
    );

    await request(app.getHttpServer())
      .get(`${API_VERSIONED_PREFIX}/rate-limit-protected-probe`)
      .expect(401);
    await request(app.getHttpServer())
      .get(`${API_VERSIONED_PREFIX}/rate-limit-protected-probe`)
      .expect(401);
    await request(app.getHttpServer())
      .get(`${API_VERSIONED_PREFIX}/rate-limit-protected-probe`)
      .expect(429);
  });

  it('When health probes exceed the starter route limit, then they are not throttled', async () => {
    app = await createApplication(
      createConfig({ RATE_LIMIT_MAX: '1', RATE_LIMIT_TTL_SECONDS: '60' }),
    );

    await request(app.getHttpServer())
      .get(`${API_VERSIONED_PREFIX}/health/live`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`${API_VERSIONED_PREFIX}/health/live`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`${API_VERSIONED_PREFIX}/health/ready`)
      .expect(503);
    await request(app.getHttpServer())
      .get(`${API_VERSIONED_PREFIX}/health/ready`)
      .expect(503);
  });

  it('When a cross-site safe request has no origin, then any starter-owned route accepts it', async () => {
    app = await createApplication(
      createConfig({
        DEPLOYMENT_TOPOLOGY: 'cross-site',
        PUBLIC_BASE_URL: 'https://api.example.com',
      }),
    );

    await request(app.getHttpServer())
      .get(`${API_VERSIONED_PREFIX}/validation-probe`)
      .expect(200);
  });

  it('When an unhandled exception occurs, then the response hides infrastructure internals behind the generic error contract', async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [FailureProbeController],
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await configureApplication(app);
    await app.init();

    const response = await request(app.getHttpServer())
      .get(`${API_VERSIONED_PREFIX}/failure-probe`)
      .expect(500);
    const error = response.body as StandardError & {
      message: string;
      timestamp: string;
    };

    expect(error).toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      path: `${API_VERSIONED_PREFIX}/failure-probe`,
      statusCode: 500,
    });
    expect(error.requestId).toEqual(expect.any(String));
    expect(error.timestamp).toEqual(expect.any(String));

    const raw = JSON.stringify(error);
    expect(raw).not.toContain('ECONNREFUSED');
    expect(raw).not.toContain('5432');
    expect(raw).not.toContain('postgres');
  });

  it('When the application is not in production, then OpenAPI exposes user response contracts', async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await configureApplication(app);
    await app.init();

    const response = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    const document = response.body as OpenAPIObject;

    expect(document.components?.schemas?.UserResponseDto).toMatchObject({
      properties: {
        createdAt: { format: 'date-time', type: 'string' },
        email: { format: 'email', type: 'string' },
        role: { enum: ['USER', 'ADMIN'], type: 'string' },
        updatedAt: { format: 'date-time', type: 'string' },
      },
      required: ['id', 'email', 'role', 'createdAt', 'updatedAt'],
      type: 'object',
    });
    expect(document.components?.schemas?.UserResponseDto).toMatchObject({
      properties: { id: { example: 'user-id', type: 'string' } },
    });
    expect(
      document.components?.schemas?.PaginatedUsersResponseDto,
    ).toMatchObject({
      properties: {
        data: {
          items: { $ref: '#/components/schemas/UserResponseDto' },
          type: 'array',
        },
        meta: { $ref: '#/components/schemas/PaginationMetaDto' },
      },
      required: ['data', 'meta'],
      type: 'object',
    });
  });

  it('When the application is not in production, then OpenAPI documents versioned starter routes and unversioned authentication routes', async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await configureApplication(app);
    await app.init();

    const response = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    const document = response.body as OpenAPIObject;
    const paths = Object.keys(document.paths ?? {});

    expect(paths).toEqual(
      expect.arrayContaining([
        `${API_VERSIONED_PREFIX}/users`,
        `${API_VERSIONED_PREFIX}/users/me`,
        `${API_VERSIONED_PREFIX}/users/{id}`,
        `${API_VERSIONED_PREFIX}/health/live`,
        `${API_VERSIONED_PREFIX}/health/ready`,
        '/api/auth/sign-up/email',
        '/api/auth/sign-in/email',
        '/api/auth/sign-out',
        '/api/auth/get-session',
      ]),
    );
    expect(paths.some((path) => /^\/users(\/|$)/.test(path))).toBe(false);
    expect(paths.some((path) => /^\/health(\/|$)/.test(path))).toBe(false);
  });

  it('When a required configuration value is absent, then application initialization fails', () => {
    const environment = { ...process.env };
    delete environment.BETTER_AUTH_SECRET;

    expect(() => validateEnvironment(environment)).toThrow(
      'BETTER_AUTH_SECRET',
    );
  });

  it('When unrelated container configuration is present, then application configuration accepts it', () => {
    const environment = {
      ...process.env,
      CONTAINER_METADATA: 'injected-by-container-runtime',
    };

    expect(() => validateEnvironment(environment)).not.toThrow();
  });
});
