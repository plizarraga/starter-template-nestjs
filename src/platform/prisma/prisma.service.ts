import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PlatformError } from '../errors/platform-error';

@Injectable()
export class PrismaService extends PrismaClient {
  async check(): Promise<void> {
    try {
      await this.$queryRawUnsafe('SELECT 1');
    } catch {
      throw new PlatformError('SERVICE_UNAVAILABLE');
    }
  }
}
