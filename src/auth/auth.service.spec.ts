import { Role } from '../generated/prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PlatformError } from '../platform/errors/platform-error';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('When registering a user, then it normalizes the email, hashes the password, and assigns USER', async () => {
    const users = {
      create: vi.fn().mockResolvedValue({
        createdAt: new Date('2026-08-17T00:00:00.000Z'),
        email: 'reader@example.com',
        id: 'user-1',
        role: Role.USER,
        updatedAt: new Date('2026-08-17T00:00:00.000Z'),
      }),
    };
    const password = { hash: vi.fn().mockResolvedValue('password-hash') };
    const service = new AuthService(
      users as never,
      password as never,
      {} as never,
      {} as never,
      { info: vi.fn() } as never,
    );

    const user = await service.register({
      email: ' Reader@Example.com ',
      password: 'password-123',
    });

    expect(password.hash).toHaveBeenCalledWith('password-123');
    expect(users.create).toHaveBeenCalledWith({
      email: 'reader@example.com',
      passwordHash: 'password-hash',
      role: Role.USER,
    });
    expect(user).not.toHaveProperty('passwordHash');
    expect(user).toMatchObject({
      email: 'reader@example.com',
      role: Role.USER,
    });
  });

  it('When credentials are valid, then it creates an independent session and issues an access token', async () => {
    const user = {
      createdAt: new Date(),
      email: 'reader@example.com',
      id: 'user-1',
      passwordHash: 'password-hash',
      role: Role.USER,
      updatedAt: new Date(),
    };
    const users = { findByEmailWithPassword: vi.fn().mockResolvedValue(user) };
    const password = { verify: vi.fn().mockResolvedValue(true) };
    const accessTokens = {
      expiresIn: vi.fn().mockReturnValue(600),
      issue: vi.fn().mockResolvedValue('signed-access-token'),
    };
    const sessions = {
      create: vi.fn().mockResolvedValue('session-1.secret-1'),
    };
    const service = new AuthService(
      users as never,
      password as never,
      accessTokens as never,
      sessions as never,
      { info: vi.fn(), warn: vi.fn() } as never,
    );

    const result = await service.login({
      email: 'READER@example.com',
      password: 'password-123',
    });

    expect(sessions.create).toHaveBeenCalledWith('user-1');
    expect(accessTokens.issue).toHaveBeenCalledWith({
      id: 'user-1',
      role: Role.USER,
    });
    expect(result).toEqual({
      accessToken: 'signed-access-token',
      expiresIn: 600,
      refreshToken: 'session-1.secret-1',
      tokenType: 'Bearer',
    });
  });

  it('When a refresh credential is valid, then it rotates the session and issues a replacement access credential', async () => {
    const users = {
      findById: vi.fn().mockResolvedValue({ id: 'user-1', role: Role.USER }),
    };
    const accessTokens = {
      expiresIn: vi.fn().mockReturnValue(600),
      issue: vi.fn().mockResolvedValue('replacement-access-token'),
    };
    const sessions = {
      rotate: vi.fn().mockResolvedValue({
        refreshToken: 'session-1.secret-2',
        userId: 'user-1',
      }),
    };
    const service = new AuthService(
      users as never,
      {} as never,
      accessTokens as never,
      sessions as never,
      { info: vi.fn(), warn: vi.fn() } as never,
    );

    const result = await service.refresh('session-1.secret-1');

    expect(sessions.rotate).toHaveBeenCalledWith('session-1.secret-1');
    expect(accessTokens.issue).toHaveBeenCalledWith({
      id: 'user-1',
      role: Role.USER,
    });
    expect(result).toEqual({
      accessToken: 'replacement-access-token',
      expiresIn: 600,
      refreshToken: 'session-1.secret-2',
      tokenType: 'Bearer',
    });
  });

  it('When logging out, then it revokes the presented refresh session', async () => {
    const sessions = { revoke: vi.fn().mockResolvedValue(undefined) };
    const service = new AuthService(
      {} as never,
      {} as never,
      {} as never,
      sessions as never,
      { info: vi.fn(), warn: vi.fn() } as never,
    );

    await service.logout('session-1.secret-1');

    expect(sessions.revoke).toHaveBeenCalledWith('session-1.secret-1');
  });

  it('When logging out of all sessions, then it revokes sessions for the authenticated principal', async () => {
    const sessions = { revokeAll: vi.fn().mockResolvedValue(undefined) };
    const service = new AuthService(
      {} as never,
      {} as never,
      {} as never,
      sessions as never,
      { info: vi.fn(), warn: vi.fn() } as never,
    );

    await service.logoutAll('user-1');

    expect(sessions.revokeAll).toHaveBeenCalledWith('user-1');
  });

  it('When updating a profile with the current password, then it normalizes the email and revokes sessions after saving', async () => {
    const users = {
      findByIdWithPassword: vi.fn().mockResolvedValue({
        id: 'user-1',
        passwordHash: 'password-hash',
      }),
      transact: vi.fn(
        (
          work: (users: {
            updateEmail: () => Promise<unknown>;
          }) => Promise<unknown>,
        ) =>
          work({
            updateEmail: vi
              .fn()
              .mockResolvedValue({ email: 'reader@example.com', id: 'user-1' }),
          }),
      ),
    };
    const passwords = { verify: vi.fn().mockResolvedValue(true) };
    const sessions = { revokeAll: vi.fn().mockResolvedValue(undefined) };
    const service = new AuthService(
      users as never,
      passwords as never,
      {} as never,
      sessions as never,
      { info: vi.fn(), warn: vi.fn() } as never,
    );

    const result = await service.updateProfile('user-1', {
      currentPassword: 'password-123',
      email: ' Reader@Example.com ',
    });

    expect(users.transact).toHaveBeenCalledWith(expect.any(Function));
    expect(sessions.revokeAll).toHaveBeenCalledWith('user-1');
    expect(result).toMatchObject({ email: 'reader@example.com' });
  });

  it('When a profile update cannot be saved, then it preserves active sessions', async () => {
    const users = {
      findByIdWithPassword: vi.fn().mockResolvedValue({
        id: 'user-1',
        passwordHash: 'password-hash',
      }),
      transact: vi
        .fn()
        .mockRejectedValue(new PlatformError('USER_EMAIL_ALREADY_EXISTS')),
    };
    const sessions = { revokeAll: vi.fn() };
    const service = new AuthService(
      users as never,
      { verify: vi.fn().mockResolvedValue(true) } as never,
      {} as never,
      sessions as never,
      { info: vi.fn(), warn: vi.fn() } as never,
    );

    await expect(
      service.updateProfile('user-1', {
        currentPassword: 'password-123',
        email: 'existing@example.com',
      }),
    ).rejects.toMatchObject({ code: 'USER_EMAIL_ALREADY_EXISTS' });

    expect(sessions.revokeAll).not.toHaveBeenCalled();
  });

  it('When changing a password with the current password, then it saves a new hash and revokes sessions', async () => {
    const users = {
      findByIdWithPassword: vi.fn().mockResolvedValue({
        id: 'user-1',
        passwordHash: 'password-hash',
      }),
      transact: vi.fn(
        (
          work: (users: {
            updatePassword: () => Promise<void>;
          }) => Promise<void>,
        ) => work({ updatePassword: vi.fn().mockResolvedValue(undefined) }),
      ),
    };
    const passwords = {
      hash: vi.fn().mockResolvedValue('new-password-hash'),
      verify: vi.fn().mockResolvedValue(true),
    };
    const sessions = { revokeAll: vi.fn().mockResolvedValue(undefined) };
    const service = new AuthService(
      users as never,
      passwords as never,
      {} as never,
      sessions as never,
      { info: vi.fn(), warn: vi.fn() } as never,
    );

    await service.changePassword('user-1', {
      currentPassword: 'password-123',
      newPassword: 'password-456',
    });

    expect(passwords.hash).toHaveBeenCalledWith('password-456');
    expect(sessions.revokeAll).toHaveBeenCalledWith('user-1');
    expect(users.transact).toHaveBeenCalledWith(expect.any(Function));
  });

  it('When a password update cannot be saved, then it preserves active sessions', async () => {
    const users = {
      findByIdWithPassword: vi.fn().mockResolvedValue({
        id: 'user-1',
        passwordHash: 'password-hash',
      }),
      transact: vi.fn().mockRejectedValue(new Error('database failed')),
    };
    const sessions = { revokeAll: vi.fn() };
    const service = new AuthService(
      users as never,
      {
        hash: vi.fn().mockResolvedValue('new-password-hash'),
        verify: vi.fn().mockResolvedValue(true),
      } as never,
      {} as never,
      sessions as never,
      { info: vi.fn(), warn: vi.fn() } as never,
    );

    await expect(
      service.changePassword('user-1', {
        currentPassword: 'password-123',
        newPassword: 'password-456',
      }),
    ).rejects.toThrow('database failed');

    expect(sessions.revokeAll).not.toHaveBeenCalled();
  });

  it('When a password is incorrect, then login returns the same invalid-credentials error', async () => {
    const service = new AuthService(
      {
        findByEmailWithPassword: vi.fn().mockResolvedValue({
          id: 'user-1',
          passwordHash: 'password-hash',
        }),
      } as never,
      { verify: vi.fn().mockResolvedValue(false) } as never,
      {} as never,
      {} as never,
      { info: vi.fn(), warn: vi.fn() } as never,
    );

    await expect(
      service.login({
        email: 'reader@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('When the session store fails, then login fails closed instead of returning tokens', async () => {
    const users = {
      findByEmailWithPassword: vi.fn().mockResolvedValue({
        id: 'user-1',
        passwordHash: 'password-hash',
      }),
    };
    const password = { verify: vi.fn().mockResolvedValue(true) };
    const accessTokens = { issue: vi.fn() };
    const sessions = {
      create: vi
        .fn()
        .mockRejectedValue(new PlatformError('SERVICE_UNAVAILABLE')),
    };
    const service = new AuthService(
      users as never,
      password as never,
      accessTokens as never,
      sessions as never,
      { info: vi.fn(), warn: vi.fn() } as never,
    );

    await expect(
      service.login({ email: 'reader@example.com', password: 'password-123' }),
    ).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });

    expect(accessTokens.issue).not.toHaveBeenCalled();
  });

  it('When a user does not exist, then login consumes password-verification cost before failing', async () => {
    const password = {
      consumeVerificationCost: vi.fn().mockResolvedValue(undefined),
    };
    const service = new AuthService(
      { findByEmailWithPassword: vi.fn().mockResolvedValue(null) } as never,
      password as never,
      {} as never,
      {} as never,
      { info: vi.fn(), warn: vi.fn() } as never,
    );

    await expect(
      service.login({ email: 'unknown@example.com', password: 'password-123' }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(password.consumeVerificationCost).toHaveBeenCalledWith(
      'password-123',
    );
  });

  it('When a refresh session references a missing user, then it rejects', async () => {
    const service = new AuthService(
      { findById: vi.fn().mockResolvedValue(null) } as never,
      {} as never,
      {} as never,
      {
        rotate: vi.fn().mockResolvedValue({
          refreshToken: 'session-1.secret-2',
          userId: 'ghost-user',
        }),
      } as never,
      { info: vi.fn(), warn: vi.fn() } as never,
    );

    await expect(service.refresh('session-1.secret-1')).rejects.toMatchObject({
      code: 'INVALID_REFRESH_TOKEN',
    });
  });

  it('When updating the profile of a missing user, then it rejects with USER_NOT_FOUND', async () => {
    const service = new AuthService(
      { findByIdWithPassword: vi.fn().mockResolvedValue(null) } as never,
      {} as never,
      {} as never,
      {} as never,
      { info: vi.fn(), warn: vi.fn() } as never,
    );

    await expect(
      service.updateProfile('ghost-user', {
        currentPassword: 'password-123',
        email: 'reader@example.com',
      }),
    ).rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
  });
});
