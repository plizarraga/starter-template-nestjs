import { HttpException, HttpStatus } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { HttpExceptionFilter } from './http-exception.filter';
import { PlatformError } from './platform-error';

const logger = { error: vi.fn() };

function makeHost(originalUrl: string) {
  const response = {
    json: vi.fn(),
    status: vi.fn().mockReturnThis(),
  };
  return {
    host: {
      switchToHttp: () => ({
        getRequest: () => ({ originalUrl, requestId: 'request-1' }),
        getResponse: () => response,
      }),
    },
    response,
  };
}

describe('HttpExceptionFilter', () => {
  it('When an HTTP exception has a status without a mapped definition, then it falls back to a generic body', () => {
    const { host, response } = makeHost('/teapot');
    const filter = new HttpExceptionFilter(logger as never);

    filter.catch(
      new HttpException('teapot', HttpStatus.I_AM_A_TEAPOT),
      host as never,
    );

    expect(response.status).toHaveBeenCalledWith(HttpStatus.I_AM_A_TEAPOT);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'INTERNAL_SERVER_ERROR',
        statusCode: HttpStatus.I_AM_A_TEAPOT,
      }),
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('When a platform error maps to a status, then it reuses its definition', () => {
    const { host, response } = makeHost('/users/me');
    const filter = new HttpExceptionFilter(logger as never);

    filter.catch(new PlatformError('UNAUTHORIZED'), host as never);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'UNAUTHORIZED',
        statusCode: HttpStatus.UNAUTHORIZED,
      }),
    );
  });

  it('When a 500-level platform error occurs, then it is logged', () => {
    const { host, response } = makeHost('/auth/login');
    const filter = new HttpExceptionFilter(logger as never);

    filter.catch(new PlatformError('SERVICE_UNAVAILABLE'), host as never);

    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.SERVICE_UNAVAILABLE,
    );
    expect(logger.error).toHaveBeenCalled();
  });

  it('When an unexpected error occurs, then it is logged as a 500', () => {
    const { host, response } = makeHost('/health');
    const filter = new HttpExceptionFilter(logger as never);

    filter.catch(new Error('boom'), host as never);

    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(logger.error).toHaveBeenCalled();
  });
});
