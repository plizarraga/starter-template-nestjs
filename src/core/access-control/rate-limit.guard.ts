import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { API_VERSIONED_PREFIX } from '../http/api-version';

@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.path.startsWith(`${API_VERSIONED_PREFIX}/health/`)) {
      return true;
    }

    return super.canActivate(context);
  }
}
