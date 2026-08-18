import { Body, Controller, Post } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { IsEmail } from 'class-validator';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../src/app.module';
import { validateEnvironment } from '../../src/platform/config/environment';
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

@Controller('validation-probe')
class ValidationProbeController {
  @Post()
  create(@Body() body: ValidationProbeDto): ValidationProbeDto {
    return body;
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
    configureApplication(app);
    await app.init();

    const response = await request(app.getHttpServer())
      .get('/missing')
      .expect(404);
    const error = response.body as StandardError;

    expect(response.headers['x-request-id']).toBe(error.requestId);
    expect(error).toMatchObject({
      code: 'NOT_FOUND',
      path: '/missing',
      statusCode: 404,
    });
  });

  it('When a trusted request ID is supplied, then it is propagated to the response and error', async () => {
    const requestId = 'upstream-request-42';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApplication(app);
    await app.init();

    const response = await request(app.getHttpServer())
      .get('/missing')
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
    configureApplication(app);
    await app.init();

    const response = await request(app.getHttpServer())
      .get('/')
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
    configureApplication(app);
    await app.init();

    const response = await request(app.getHttpServer())
      .post('/validation-probe')
      .send({ email: 'reader@example.com', role: 'ADMIN' })
      .expect(400);
    const error = response.body as StandardError;

    expect(error).toMatchObject({
      code: 'VALIDATION_ERROR',
      path: '/validation-probe',
      statusCode: 400,
    });
  });

  it('When the application is not in production, then its OpenAPI documentation is available', async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApplication(app);
    await app.init();

    await request(app.getHttpServer()).get('/docs').expect(200);
  });

  it('When a required configuration value is absent, then application initialization fails', () => {
    const environment = { ...process.env };
    delete environment.JWT_SECRET;

    expect(() => validateEnvironment(environment)).toThrow('JWT_SECRET');
  });

  it('When unrelated container configuration is present, then application configuration accepts it', () => {
    const environment = {
      ...process.env,
      CONTAINER_PORT_6379_TCP: 'tcp://redis',
    };

    expect(() => validateEnvironment(environment)).not.toThrow();
  });
});
