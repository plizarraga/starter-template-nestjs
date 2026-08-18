import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { Environment } from '../platform/config/environment';
import { PlatformError } from '../platform/errors/platform-error';
import { RedisService } from '../platform/redis/redis.service';

@Injectable()
export class AuthSessionRepository {
  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  async create(userId: string): Promise<string> {
    const sessionId = randomUUID();
    const secret = this.createSecret();
    await this.redis.createAuthenticationSession(
      userId,
      sessionId,
      this.protectSecret(secret),
    );
    return `${sessionId}.${secret}`;
  }

  async rotate(refreshToken: string): Promise<{
    refreshToken: string;
    userId: string;
  }> {
    const parsed = this.parse(refreshToken);
    if (parsed === undefined) {
      throw new PlatformError('INVALID_REFRESH_TOKEN');
    }

    const secret = this.createSecret();
    const userId = await this.redis.rotateAuthenticationSession(
      parsed.sessionId,
      this.protectSecret(parsed.secret),
      this.protectSecret(secret),
    );
    if (userId === null) {
      throw new PlatformError('INVALID_REFRESH_TOKEN');
    }
    return { refreshToken: `${parsed.sessionId}.${secret}`, userId };
  }

  async revoke(refreshToken: string | undefined): Promise<void> {
    const parsed =
      refreshToken === undefined ? undefined : this.parse(refreshToken);
    if (parsed === undefined) {
      return;
    }
    await this.redis.revokeAuthenticationSession(
      parsed.sessionId,
      this.protectSecret(parsed.secret),
    );
  }

  revokeAll(userId: string): Promise<void> {
    return this.redis.revokeUserAuthenticationSessions(userId);
  }

  private createSecret(): string {
    return randomBytes(32).toString('base64url');
  }

  private parse(
    refreshToken: string,
  ): { secret: string; sessionId: string } | undefined {
    const [sessionId, secret, extra] = refreshToken.split('.');
    return sessionId !== undefined &&
      secret !== undefined &&
      extra === undefined
      ? { secret, sessionId }
      : undefined;
  }

  private protectSecret(secret: string): string {
    return createHmac(
      'sha256',
      this.config.getOrThrow('REFRESH_TOKEN_HMAC_SECRET'),
    )
      .update(secret)
      .digest('hex');
  }
}
