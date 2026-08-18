import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { PlatformError } from '../platform/errors/platform-error';
import { AccessTokenService } from './access-token.service';

const secret = 'test-jwt-secret-that-is-long-enough';

describe('AccessTokenService', () => {
  it('When a token has an unexpected issuer, then it rejects it as invalid', async () => {
    const accessTokens = new AccessTokenService(
      new JwtService({
        secret,
        signOptions: { audience: 'starter-client', issuer: 'starter-api' },
        verifyOptions: { audience: 'starter-client', issuer: 'starter-api' },
      }),
      { getOrThrow: () => 600 } as never,
    );
    const foreignToken = await new JwtService({
      secret,
      signOptions: { audience: 'starter-client', issuer: 'another-api' },
    }).signAsync({ role: Role.USER, sub: 'user-1' });

    await expect(accessTokens.verify(foreignToken)).rejects.toEqual(
      new PlatformError('INVALID_ACCESS_TOKEN'),
    );
  });
});
