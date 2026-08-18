import { Role } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
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
    const sessions = { create: vi.fn().mockResolvedValue(undefined) };
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
      tokenType: 'Bearer',
    });
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
});
