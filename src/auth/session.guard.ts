import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { Role } from '../generated/prisma/client';
import { PlatformError } from '../platform/errors/platform-error';
import { UsersService } from '../users/users.service';
import { BetterAuthService } from './better-auth.service';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';

export type AuthenticatedRequest = Request & {
  principal?: { id: string; role: Role };
};

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly auth: BetterAuthService,
    private readonly users: UsersService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) {
      return true;
    }

    const http = context.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();
    const response = http.getResponse<Response>();
    const session = await this.auth.getSession(request, response);
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
