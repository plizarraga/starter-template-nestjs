import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { Environment } from '../platform/config/environment';
import { toArgon2Options } from '../platform/security/argon2-options';

@Injectable()
export class PasswordService {
  constructor(private readonly config: ConfigService<Environment, true>) {}

  async hash(password: string): Promise<string> {
    return argon2.hash(password, this.options());
  }

  async verify(password: string, encodedHash: string): Promise<boolean> {
    try {
      return await argon2.verify(encodedHash, password);
    } catch {
      // A malformed/foreign digest (e.g. corrupted data) must fail closed
      // as "no match", not surface as an unhandled error on the login path.
      return false;
    }
  }

  async consumeVerificationCost(password: string): Promise<void> {
    await this.hash(password);
  }

  private options(): argon2.HashOptions {
    return toArgon2Options({
      memoryCost: this.config.getOrThrow<number>('ARGON2_MEMORY_COST'),
      timeCost: this.config.getOrThrow<number>('ARGON2_TIME_COST'),
      parallelism: this.config.getOrThrow<number>('ARGON2_PARALLELISM'),
    });
  }
}
