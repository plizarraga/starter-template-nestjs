import { describe, expect, it, vi } from 'vitest';
import { PlatformError } from '../platform/errors/platform-error';
import { AuthSessionRepository } from './auth-session.repository';

const config = {
  getOrThrow: vi.fn().mockReturnValue('test-refresh-secret'),
} as never;

describe('AuthSessionRepository', () => {
  it('When a session is created, then it stores only the HMAC and returns an opaque credential', async () => {
    const createAuthenticationSession =
      vi.fn<
        (userId: string, sessionId: string, hmac: string) => Promise<void>
      >();
    createAuthenticationSession.mockResolvedValue(undefined);
    const sessions = new AuthSessionRepository(
      { createAuthenticationSession } as never,
      config,
    );

    const refreshToken = await sessions.create('user-1');

    const [sessionId, secret] = refreshToken.split('.');
    expect(sessionId).toBeTruthy();
    expect(secret).toBeTruthy();
    const storedHmac = createAuthenticationSession.mock.calls[0][2];
    expect(createAuthenticationSession).toHaveBeenCalledWith(
      'user-1',
      sessionId,
      storedHmac,
    );
    expect(storedHmac).not.toBe(secret);
    expect(storedHmac).toMatch(/^[0-9a-f]{64}$/);
  });

  it('When rotating a malformed refresh token, then it rejects without touching the store', async () => {
    const redis = { rotateAuthenticationSession: vi.fn() };
    const sessions = new AuthSessionRepository(redis as never, config);

    await expect(sessions.rotate('not-a-valid-token')).rejects.toEqual(
      new PlatformError('INVALID_REFRESH_TOKEN'),
    );
    expect(redis.rotateAuthenticationSession).not.toHaveBeenCalled();
  });

  it('When rotating a refresh token with too many segments, then it rejects', async () => {
    const redis = { rotateAuthenticationSession: vi.fn() };
    const sessions = new AuthSessionRepository(redis as never, config);

    await expect(sessions.rotate('a.b.c')).rejects.toEqual(
      new PlatformError('INVALID_REFRESH_TOKEN'),
    );
  });

  it('When rotating an unknown session, then it rejects', async () => {
    const redis = {
      rotateAuthenticationSession: vi.fn().mockResolvedValue(null),
    };
    const sessions = new AuthSessionRepository(redis as never, config);

    await expect(sessions.rotate('session-1.secret-1')).rejects.toEqual(
      new PlatformError('INVALID_REFRESH_TOKEN'),
    );
  });

  it('When rotating a valid session, then it returns a replacement credential and the user', async () => {
    const redis = {
      rotateAuthenticationSession: vi.fn().mockResolvedValue('user-1'),
    };
    const sessions = new AuthSessionRepository(redis as never, config);

    const result = await sessions.rotate('session-1.secret-1');

    expect(result.userId).toBe('user-1');
    expect(result.refreshToken).toMatch(/^session-1\.[A-Za-z0-9_-]+$/);
    expect(redis.rotateAuthenticationSession).toHaveBeenCalledWith(
      'session-1',
      expect.any(String),
      expect.any(String),
    );
  });

  it('When revoking without a refresh token, then it does nothing', async () => {
    const redis = { revokeAuthenticationSession: vi.fn() };
    const sessions = new AuthSessionRepository(redis as never, config);

    await sessions.revoke(undefined);

    expect(redis.revokeAuthenticationSession).not.toHaveBeenCalled();
  });

  it('When revoking a malformed refresh token, then it does nothing', async () => {
    const redis = { revokeAuthenticationSession: vi.fn() };
    const sessions = new AuthSessionRepository(redis as never, config);

    await sessions.revoke('not-a-valid-token');

    expect(redis.revokeAuthenticationSession).not.toHaveBeenCalled();
  });

  it('When revoking a well-formed session, then it revokes by id and hmac', async () => {
    const redis = {
      revokeAuthenticationSession: vi.fn().mockResolvedValue(undefined),
    };
    const sessions = new AuthSessionRepository(redis as never, config);

    await sessions.revoke('session-1.secret-1');

    expect(redis.revokeAuthenticationSession).toHaveBeenCalledWith(
      'session-1',
      expect.any(String),
    );
  });

  it('When revoking all sessions, then it delegates to the store', async () => {
    const redis = {
      revokeUserAuthenticationSessions: vi.fn().mockResolvedValue(undefined),
    };
    const sessions = new AuthSessionRepository(redis as never, config);

    await sessions.revokeAll('user-1');

    expect(redis.revokeUserAuthenticationSessions).toHaveBeenCalledWith(
      'user-1',
    );
  });
});
