import { ExecutionContext } from '@nestjs/common';
import { Role } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { RolesGuard } from './roles.guard';

function context(request: unknown): ExecutionContext {
  return {
    getClass: () => ({}) as never,
    getHandler: () => ({}) as never,
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('When no roles are required, then it activates without inspecting the principal', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(undefined) };
    const logger = { warn: vi.fn() };
    const guard = new RolesGuard(reflector as never, logger as never);

    expect(guard.canActivate(context({}))).toBe(true);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('When the principal has a required role, then it activates', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue([Role.ADMIN]),
    };
    const logger = { warn: vi.fn() };
    const guard = new RolesGuard(reflector as never, logger as never);
    const request = { principal: { id: 'user-1', role: Role.ADMIN } };

    expect(guard.canActivate(context(request))).toBe(true);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('When the principal lacks a required role, then it records a safe denial event and rejects', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue([Role.ADMIN]),
    };
    const logger = { warn: vi.fn() };
    const guard = new RolesGuard(reflector as never, logger as never);
    const request = {
      originalUrl: '/users',
      principal: { id: 'user-1', role: Role.USER },
    };

    expect(() => guard.canActivate(context(request))).toThrowError(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
    expect(logger.warn).toHaveBeenCalledWith({
      event: 'authz.denied',
      path: '/users',
      requiredRoles: [Role.ADMIN],
      role: Role.USER,
      userId: 'user-1',
    });
  });

  it('When no principal is attached to the request, then it rejects as unauthenticated', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue([Role.ADMIN]),
    };
    const logger = { warn: vi.fn() };
    const guard = new RolesGuard(reflector as never, logger as never);

    expect(() => guard.canActivate(context({}))).toThrowError(
      expect.objectContaining({ code: 'UNAUTHORIZED' }),
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
