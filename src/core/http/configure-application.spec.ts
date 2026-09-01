import { VersioningType } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { describe, expect, it, vi } from 'vitest';
import {
  API_DEFAULT_VERSION,
  API_GLOBAL_PREFIX,
  API_VERSION_PREFIX,
} from './api-version';
import { configureApplication } from './configure-application';

function makeApp(config: { getOrThrow: (key: string) => unknown }) {
  return {
    enableCors: vi.fn(),
    enableVersioning: vi.fn(),
    get: vi.fn().mockReturnValue({
      ...config,
      basePath: '/api/auth',
      contributeOpenApiDocument: vi.fn().mockResolvedValue(undefined),
      handler: vi.fn(),
    }),
    set: vi.fn(),
    setGlobalPrefix: vi.fn(),
    use: vi.fn(),
    useGlobalFilters: vi.fn(),
    useGlobalPipes: vi.fn(),
  };
}

describe('configureApplication', () => {
  it('When running in production, then it skips the Swagger setup', async () => {
    const createDocument = vi
      .spyOn(SwaggerModule, 'createDocument')
      .mockReturnValue({} as never);
    const setup = vi.spyOn(SwaggerModule, 'setup').mockImplementation(() => {});
    const config = {
      getOrThrow: (key: string) =>
        key === 'NODE_ENV'
          ? 'production'
          : key === 'CORS_ORIGINS'
            ? 'http://localhost:3001'
            : undefined,
    };

    await configureApplication(makeApp(config) as never);

    expect(createDocument).not.toHaveBeenCalled();
    expect(setup).not.toHaveBeenCalled();
    createDocument.mockRestore();
    setup.mockRestore();
  });

  it('When not in production, then it sets up Swagger at /docs', async () => {
    const createDocument = vi
      .spyOn(SwaggerModule, 'createDocument')
      .mockReturnValue({ components: { schemas: {} }, paths: {} } as never);
    const setup = vi.spyOn(SwaggerModule, 'setup').mockImplementation(() => {});
    const config = {
      getOrThrow: (key: string) =>
        key === 'NODE_ENV'
          ? 'development'
          : key === 'CORS_ORIGINS'
            ? 'http://localhost:3001'
            : undefined,
    };

    await configureApplication(makeApp(config) as never);

    expect(createDocument).toHaveBeenCalled();
    expect(setup).toHaveBeenCalledWith(
      'docs',
      expect.anything(),
      expect.anything(),
      { swaggerOptions: { persistAuthorization: true, withCredentials: true } },
    );
    expect(createDocument.mock.calls[0]?.[1]).toMatchObject({
      components: {
        securitySchemes: {
          cookie: {
            in: 'cookie',
            name: 'better-auth.session_token',
            type: 'apiKey',
          },
        },
      },
    });
    createDocument.mockRestore();
    setup.mockRestore();
  });

  it('When not in production, then the description explains that the Authorize dialog cannot set the session cookie', async () => {
    const createDocument = vi
      .spyOn(SwaggerModule, 'createDocument')
      .mockReturnValue({ components: { schemas: {} }, paths: {} } as never);
    const setup = vi.spyOn(SwaggerModule, 'setup').mockImplementation(() => {});
    const config = {
      getOrThrow: (key: string) =>
        key === 'NODE_ENV'
          ? 'development'
          : key === 'CORS_ORIGINS'
            ? 'http://localhost:3001'
            : undefined,
    };

    await configureApplication(makeApp(config) as never);

    const built = createDocument.mock.calls[0]?.[1] as
      { info: { description: string } } | undefined;
    const description = built?.info.description ?? '';
    expect(description).toContain('User administration API');
    expect(description).toContain('Authorize dialog cannot set');
    expect(description).toContain('Cookie header');
    expect(description).toContain('/api/auth/sign-in/email');
    createDocument.mockRestore();
    setup.mockRestore();
  });

  it('When a proxy hop count is configured, then Express trusts exactly that many hops', async () => {
    const createDocument = vi
      .spyOn(SwaggerModule, 'createDocument')
      .mockReturnValue({ components: { schemas: {} }, paths: {} } as never);
    vi.spyOn(SwaggerModule, 'setup').mockImplementation(() => {});
    const config = {
      getOrThrow: (key: string) =>
        key === 'NODE_ENV'
          ? 'development'
          : key === 'CORS_ORIGINS'
            ? 'http://localhost:3001'
            : key === 'TRUST_PROXY_HOPS'
              ? 3
              : undefined,
    };
    const app = makeApp(config);

    await configureApplication(app as never);

    expect(app.set).toHaveBeenCalledWith('trust proxy', 3);
    createDocument.mockRestore();
  });

  it('When configuring the application, then it serves starter routes under the versioned API prefix', async () => {
    const createDocument = vi
      .spyOn(SwaggerModule, 'createDocument')
      .mockReturnValue({ components: { schemas: {} }, paths: {} } as never);
    vi.spyOn(SwaggerModule, 'setup').mockImplementation(() => {});
    const config = {
      getOrThrow: (key: string) =>
        key === 'NODE_ENV'
          ? 'development'
          : key === 'CORS_ORIGINS'
            ? 'http://localhost:3001'
            : undefined,
    };
    const app = makeApp(config);

    await configureApplication(app as never);

    expect(app.setGlobalPrefix).toHaveBeenCalledWith(API_GLOBAL_PREFIX);
    expect(app.enableVersioning).toHaveBeenCalledWith({
      type: VersioningType.URI,
      defaultVersion: API_DEFAULT_VERSION,
      prefix: API_VERSION_PREFIX,
    });
    createDocument.mockRestore();
  });
});
