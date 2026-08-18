import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { Environment } from '../config/environment';
import { PlatformError } from '../errors/platform-error';

@Injectable()
export class PrismaService extends PrismaClient {
  constructor(config: ConfigService<Environment, true>) {
    const adapter = new PrismaPg(
      { connectionString: config.getOrThrow('DATABASE_URL') },
      { schema: config.getOrThrow('DATABASE_SCHEMA') },
    );
    super({ adapter });
  }

  async check(): Promise<void> {
    try {
      await this.$queryRawUnsafe('SELECT 1');
    } catch {
      throw new PlatformError('SERVICE_UNAVAILABLE');
    }
  }
}
