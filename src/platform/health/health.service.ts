import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export type DependencyStatus = 'up' | 'down';

export type ReadinessCheck = {
  postgres: DependencyStatus;
  redis: DependencyStatus;
};

export type ReadinessResult = {
  ready: boolean;
  checks: ReadinessCheck;
};

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async checkReadiness(): Promise<ReadinessResult> {
    const [postgres, redis] = await Promise.allSettled([
      this.prisma.check(),
      this.redis.check(),
    ]);
    const checks: ReadinessCheck = {
      postgres: postgres.status === 'fulfilled' ? 'up' : 'down',
      redis: redis.status === 'fulfilled' ? 'up' : 'down',
    };
    return {
      ready: Object.values(checks).every((status) => status === 'up'),
      checks,
    };
  }
}
