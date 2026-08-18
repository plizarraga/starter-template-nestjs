import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { PlatformError } from '../../platform/errors/platform-error';
import { AuthenticatedRequest } from '../access-token.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectPinoLogger(RolesGuard.name) private readonly logger: PinoLogger,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredRoles === undefined || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const principal = request.principal;
    if (principal === undefined) {
      throw new PlatformError('UNAUTHORIZED');
    }
    if (!requiredRoles.includes(principal.role)) {
      this.logger.warn({
        event: 'authz.denied',
        path: request.originalUrl,
        requiredRoles,
        role: principal.role,
        userId: principal.id,
      });
      throw new PlatformError('FORBIDDEN');
    }
    return true;
  }
}
