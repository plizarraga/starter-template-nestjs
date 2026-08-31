import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Environment } from '../config/environment';
import { PlatformError } from '../errors/platform-error';

@Injectable()
export class OriginValidator {
  constructor(private readonly config: ConfigService<Environment, true>) {}

  requireAllowed(origin: string | string[] | undefined): void {
    const allowedOrigins = this.config
      .getOrThrow<string>('CORS_ORIGINS')
      .split(',')
      .map((value) => value.trim());
    if (typeof origin !== 'string' || !allowedOrigins.includes(origin)) {
      throw new PlatformError('FORBIDDEN');
    }
  }
}
