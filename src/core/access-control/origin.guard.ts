import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { DeploymentTopology, Environment } from '../config/environment';
import { OriginValidator } from '../http/origin-validator.service';

const stateChangingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class OriginGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService<Environment, true>,
    private readonly originValidator: OriginValidator,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (
      this.config.getOrThrow<DeploymentTopology>('DEPLOYMENT_TOPOLOGY') ===
        'cross-site' &&
      stateChangingMethods.has(request.method)
    ) {
      this.originValidator.requireAllowed(request.headers.origin);
    }
    return true;
  }
}
