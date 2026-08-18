import { JwtService } from '@nestjs/jwt';
import { Role } from '../generated/prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PlatformError } from '../platform/errors/platform-error';
import { AccessTokenService } from './access-token.service';

const secret = 'test-jwt-secret-that-is-long-enough';

describe('AccessTokenService', () => {
  it('When a token has an unexpected issuer or algorithm, then it rejects it as invalid', async () => {
    const accessTokens = new AccessTokenService(
      new JwtService({
        secret,
        signOptions: { audience: 'starter-client', issuer: 'starter-api' },
        verifyOptions: {
          algorithms: ['HS256'],
          audience: 'starter-client',
          issuer: 'starter-api',
        },
      }),
      { getOrThrow: () => 600 } as never,
    );
    const foreignToken = await new JwtService({
      secret,
      signOptions: { audience: 'starter-client', issuer: 'another-api' },
    }).signAsync({ role: Role.USER, sub: 'user-1' });

    const nonHs256Token = await new JwtService({
      secret,
      signOptions: {
        algorithm: 'HS512',
        audience: 'starter-client',
        issuer: 'starter-api',
      },
    }).signAsync({ role: Role.USER, sub: 'user-1' });

    await expect(accessTokens.verify(foreignToken)).rejects.toEqual(
      new PlatformError('INVALID_ACCESS_TOKEN'),
    );
    await expect(accessTokens.verify(nonHs256Token)).rejects.toEqual(
      new PlatformError('INVALID_ACCESS_TOKEN'),
    );
  });

  it('When an access token has expired, then it is rejected as expired rather than merely invalid', async () => {
    const jwt = new JwtService({
      secret,
      signOptions: { audience: 'starter-client', issuer: 'starter-api' },
      verifyOptions: {
        algorithms: ['HS256'],
        audience: 'starter-client',
        issuer: 'starter-api',
      },
    });
    const accessTokens = new AccessTokenService(jwt, {
      getOrThrow: () => 600,
    } as never);
    const expiredToken = await jwt.signAsync(
      { role: Role.USER, sub: 'user-1' },
      { expiresIn: -60 },
    );

    await expect(accessTokens.verify(expiredToken)).rejects.toEqual(
      new PlatformError('ACCESS_TOKEN_EXPIRED'),
    );
  });

  it('When a token carries a non-string subject, then it is rejected as invalid', async () => {
    const jwt = new JwtService({
      secret,
      signOptions: { audience: 'starter-client', issuer: 'starter-api' },
      verifyOptions: {
        algorithms: ['HS256'],
        audience: 'starter-client',
        issuer: 'starter-api',
      },
    });
    const accessTokens = new AccessTokenService(jwt, {
      getOrThrow: () => 600,
    } as never);
    const token = await jwt.signAsync({ role: Role.USER, sub: 123 } as never);

    await expect(accessTokens.verify(token)).rejects.toEqual(
      new PlatformError('INVALID_ACCESS_TOKEN'),
    );
  });

  it('When a token carries an unknown role, then it is rejected as invalid', async () => {
    const jwt = new JwtService({
      secret,
      signOptions: { audience: 'starter-client', issuer: 'starter-api' },
      verifyOptions: {
        algorithms: ['HS256'],
        audience: 'starter-client',
        issuer: 'starter-api',
      },
    });
    const accessTokens = new AccessTokenService(jwt, {
      getOrThrow: () => 600,
    } as never);
    const token = await jwt.signAsync({
      role: 'MODERATOR',
      sub: 'user-1',
    } as never);

    await expect(accessTokens.verify(token)).rejects.toEqual(
      new PlatformError('INVALID_ACCESS_TOKEN'),
    );
  });

  it('When verification fails with a platform error, then it rethrows it unchanged', async () => {
    const jwt = {
      verifyAsync: vi
        .fn()
        .mockRejectedValue(new PlatformError('SERVICE_UNAVAILABLE')),
    };
    const accessTokens = new AccessTokenService(
      jwt as never,
      {
        getOrThrow: () => 600,
      } as never,
    );

    await expect(accessTokens.verify('token')).rejects.toEqual(
      new PlatformError('SERVICE_UNAVAILABLE'),
    );
  });

  it('When verification fails with an unexpected error, then it rejects as invalid', async () => {
    const jwt = {
      verifyAsync: vi.fn().mockRejectedValue(new Error('unexpected failure')),
    };
    const accessTokens = new AccessTokenService(
      jwt as never,
      {
        getOrThrow: () => 600,
      } as never,
    );

    await expect(accessTokens.verify('token')).rejects.toEqual(
      new PlatformError('INVALID_ACCESS_TOKEN'),
    );
  });
});
