import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role } from '../generated/prisma/client';
import { Environment } from '../platform/config/environment';
import { PlatformError } from '../platform/errors/platform-error';

export type AuthenticatedPrincipal = {
  id: string;
  role: Role;
};

type AccessTokenPayload = {
  role: Role;
  sub: string;
};

@Injectable()
export class AccessTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  issue(principal: AuthenticatedPrincipal): Promise<string> {
    return this.jwt.signAsync({ role: principal.role, sub: principal.id });
  }

  async verify(token: string): Promise<AuthenticatedPrincipal> {
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      if (
        typeof payload.sub !== 'string' ||
        (payload.role !== Role.USER && payload.role !== Role.ADMIN)
      ) {
        throw new PlatformError('INVALID_ACCESS_TOKEN');
      }
      return { id: payload.sub, role: payload.role };
    } catch (error) {
      if (error instanceof PlatformError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'TokenExpiredError') {
        throw new PlatformError('ACCESS_TOKEN_EXPIRED');
      }
      throw new PlatformError('INVALID_ACCESS_TOKEN');
    }
  }

  expiresIn(): number {
    return this.config.getOrThrow('ACCESS_TOKEN_TTL_SECONDS');
  }
}
