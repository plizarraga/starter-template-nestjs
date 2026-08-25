import { ExecutionContext } from '@nestjs/common';
import { Role } from '../generated/prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { SessionGuard } from './session.guard';

function context(request: unknown, response = {}): ExecutionContext {
  return {
    getClass: () => ({}) as never,
    getHandler: () => ({}) as never,
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
}

describe('SessionGuard', () => {
  it('When Better Auth has no session, then it rejects the request as unauthenticated', async () => {
    const auth = { getSession: vi.fn().mockResolvedValue(null) };
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(undefined) };
    const guard = new SessionGuard(auth as never, reflector as never);

    await expect(guard.canActivate(context({}))).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('When Better Auth validates a session with a domain role, then it attaches the principal without a second identity read', async () => {
    const auth = {
      getSession: vi
        .fn()
        .mockResolvedValue({ user: { id: 'user-1', role: Role.ADMIN } }),
    };
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(undefined) };
    const request = {};
    const response = {};
    const guard = new SessionGuard(auth as never, reflector as never);

    await expect(guard.canActivate(context(request, response))).resolves.toBe(
      true,
    );
    expect(request).toMatchObject({
      principal: { id: 'user-1', role: Role.ADMIN },
    });
    expect(auth.getSession).toHaveBeenCalledWith(request, response);
  });

  it('When Better Auth validates a session with an unknown role, then it rejects the request as unauthenticated', async () => {
    const auth = {
      getSession: vi
        .fn()
        .mockResolvedValue({ user: { id: 'user-1', role: 'SUPER_ADMIN' } }),
    };
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(undefined) };
    const request = {};
    const guard = new SessionGuard(auth as never, reflector as never);

    await expect(guard.canActivate(context(request))).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect(request).not.toHaveProperty('principal');
  });
});
