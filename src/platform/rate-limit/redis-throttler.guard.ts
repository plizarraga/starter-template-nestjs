import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { PlatformError } from '../errors/platform-error';

@Injectable()
export class RedisThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(): Promise<void> {
    throw new PlatformError('RATE_LIMIT_EXCEEDED');
  }
}
