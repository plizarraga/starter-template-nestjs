import { SwaggerModule } from '@nestjs/swagger';
import { describe, expect, it, vi } from 'vitest';
import { configureApplication } from './configure-application';

function makeApp(config: { getOrThrow: (key: string) => unknown }) {
  return {
    enableCors: vi.fn(),
    get: vi.fn().mockReturnValue({ ...config, handler: vi.fn() }),
    set: vi.fn(),
    use: vi.fn(),
    useGlobalFilters: vi.fn(),
    useGlobalPipes: vi.fn(),
  };
}

describe('configureApplication', () => {
  it('When running in production, then it skips the Swagger setup', () => {
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

    configureApplication(makeApp(config) as never);

    expect(createDocument).not.toHaveBeenCalled();
    expect(setup).not.toHaveBeenCalled();
    createDocument.mockRestore();
    setup.mockRestore();
  });

  it('When not in production, then it sets up Swagger at /docs', () => {
    const createDocument = vi
      .spyOn(SwaggerModule, 'createDocument')
      .mockReturnValue({} as never);
    const setup = vi.spyOn(SwaggerModule, 'setup').mockImplementation(() => {});
    const config = {
      getOrThrow: (key: string) =>
        key === 'NODE_ENV'
          ? 'development'
          : key === 'CORS_ORIGINS'
            ? 'http://localhost:3001'
            : undefined,
    };

    configureApplication(makeApp(config) as never);

    expect(createDocument).toHaveBeenCalled();
    expect(setup).toHaveBeenCalledWith(
      'docs',
      expect.anything(),
      expect.anything(),
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
});
