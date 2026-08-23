import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '../generated/prisma/client';
import { PlatformError } from '../platform/errors/platform-error';
import { UsersService } from '../users/users.service';
import { BetterAuthService } from './better-auth.service';

export type AuthenticatedRequest = Request & {
  principal?: { id: string; role: Role };
};

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly auth: BetterAuthService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const session = await this.auth.getSession(request);
    if (session === null) {
      throw new PlatformError('UNAUTHORIZED');
    }

    const user = await this.users.findById(session.user.id);
    if (user === null) {
      throw new PlatformError('UNAUTHORIZED');
    }
    request.principal = user;
    return true;
  }
}
