import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../../generated/prisma/client';
import { PinoLogger } from 'nestjs-pino';
import { PlatformError } from '../../../core/errors/platform-error';
import { AuthenticatedRequest } from '../session.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    // Plain PinoLogger, not @InjectPinoLogger: the decorated-token variant is
    // only registered if this file is evaluated before LoggerModule.forRoot(),
    // which makes resolution depend on ES module evaluation order. The class
    // name travels in the log payload instead.
    private readonly logger: PinoLogger,
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
        context: RolesGuard.name,
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
