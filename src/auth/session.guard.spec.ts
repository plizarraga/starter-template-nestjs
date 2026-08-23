import { ExecutionContext } from '@nestjs/common';
import { Role } from '../generated/prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { SessionGuard } from './session.guard';

function context(request: unknown, response = {}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
}

describe('SessionGuard', () => {
  it('When Better Auth has no session, then it rejects the request as unauthenticated', async () => {
    const auth = { getSession: vi.fn().mockResolvedValue(null) };
    const users = { findById: vi.fn() };
    const guard = new SessionGuard(auth as never, users as never);

    await expect(guard.canActivate(context({}))).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect(users.findById).not.toHaveBeenCalled();
  });

  it('When Better Auth validates a session, then it attaches the current application role', async () => {
    const auth = {
      getSession: vi.fn().mockResolvedValue({ user: { id: 'user-1' } }),
    };
    const users = {
      findById: vi.fn().mockResolvedValue({ id: 'user-1', role: Role.ADMIN }),
    };
    const request = {};
    const response = {};
    const guard = new SessionGuard(auth as never, users as never);

    await expect(guard.canActivate(context(request, response))).resolves.toBe(true);
    expect(request).toMatchObject({
      principal: { id: 'user-1', role: Role.ADMIN },
    });
    expect(auth.getSession).toHaveBeenCalledWith(request, response);
  });
});
