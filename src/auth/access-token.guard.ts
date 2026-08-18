import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { PlatformError } from '../platform/errors/platform-error';
import {
  AccessTokenService,
  AuthenticatedPrincipal,
} from './access-token.service';

export type AuthenticatedRequest = Request & {
  principal?: AuthenticatedPrincipal;
};

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly accessTokens: AccessTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.bearerToken(request.headers.authorization);
    if (token === undefined) {
      throw new PlatformError('UNAUTHORIZED');
    }

    request.principal = await this.accessTokens.verify(token);
    return true;
  }

  private bearerToken(header: string | undefined): string | undefined {
    const [scheme, token, extra] = header?.split(' ') ?? [];
    return scheme === 'Bearer' && token !== undefined && extra === undefined
      ? token
      : undefined;
  }
}
