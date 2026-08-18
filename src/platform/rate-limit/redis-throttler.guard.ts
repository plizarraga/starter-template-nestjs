import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { PlatformError } from '../errors/platform-error';

@Injectable()
export class RedisThrottlerGuard extends ThrottlerGuard {
  protected throwThrottlingException(): Promise<never> {
    return Promise.reject(new PlatformError('RATE_LIMIT_EXCEEDED'));
  }
}
