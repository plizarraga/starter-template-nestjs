import { describe, expect, it, vi } from 'vitest';
import { PlatformError } from '../platform/errors/platform-error';
import { AuthController } from './auth.controller';

const config = {
  getOrThrow: vi.fn((key: string) => {
    const values: Record<string, string | number> = {
      COOKIE_NAME: 'refresh_token',
      NODE_ENV: 'test',
      REFRESH_TOKEN_TTL_DAYS: 30,
    };
    return values[key];
  }),
} as never;

const origins = { requireAllowed: vi.fn() };

describe('AuthController', () => {
  it('When logging out without a principal, then it rejects as unauthorized', async () => {
    const auth = { logoutAll: vi.fn() };
    const controller = new AuthController(
      auth as never,
      config,
      origins as never,
    );

    await expect(controller.logoutAll({} as never)).rejects.toEqual(
      new PlatformError('UNAUTHORIZED'),
    );
    expect(auth.logoutAll).not.toHaveBeenCalled();
  });

  it('When logging out of all sessions, then it revokes the authenticated principal', async () => {
    const auth = { logoutAll: vi.fn().mockResolvedValue(undefined) };
    const controller = new AuthController(
      auth as never,
      config,
      origins as never,
    );

    await controller.logoutAll({
      principal: { id: 'user-1', role: 'USER' },
    } as never);

    expect(auth.logoutAll).toHaveBeenCalledWith('user-1');
  });

  it('When changing a password without a principal, then it rejects as unauthorized', async () => {
    const auth = { changePassword: vi.fn() };
    const controller = new AuthController(
      auth as never,
      config,
      origins as never,
    );

    await expect(
      controller.changePassword({} as never, {} as never),
    ).rejects.toEqual(new PlatformError('UNAUTHORIZED'));
    expect(auth.changePassword).not.toHaveBeenCalled();
  });

  it('When changing a password, then it delegates to the auth service', async () => {
    const auth = { changePassword: vi.fn().mockResolvedValue(undefined) };
    const controller = new AuthController(
      auth as never,
      config,
      origins as never,
    );
    const passwords = {
      currentPassword: 'current-password',
      newPassword: 'new-password',
    };

    await controller.changePassword(
      { principal: { id: 'user-1', role: 'USER' } } as never,
      passwords,
    );

    expect(auth.changePassword).toHaveBeenCalledWith('user-1', passwords);
  });

  it('When a refresh cookie cannot be decoded, then it rejects as invalid', async () => {
    const auth = { refresh: vi.fn() };
    const controller = new AuthController(
      auth as never,
      config,
      origins as never,
    );
    const request = {
      headers: {
        cookie: 'refresh_token=%E0%A4%A',
        origin: 'http://localhost:3001',
      },
    };

    await expect(
      controller.refresh(request as never, {} as never),
    ).rejects.toEqual(new PlatformError('INVALID_REFRESH_TOKEN'));
    expect(auth.refresh).not.toHaveBeenCalled();
  });

  it('When refreshing without a cookie, then it rejects as invalid', async () => {
    const auth = { refresh: vi.fn() };
    const controller = new AuthController(
      auth as never,
      config,
      origins as never,
    );
    const request = { headers: { origin: 'http://localhost:3001' } };

    await expect(
      controller.refresh(request as never, {} as never),
    ).rejects.toEqual(new PlatformError('INVALID_REFRESH_TOKEN'));
  });
});
