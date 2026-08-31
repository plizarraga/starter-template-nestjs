import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type DependencyStatus = 'up' | 'down';

export type ReadinessCheck = {
  postgres: DependencyStatus;
};

export type ReadinessResult = {
  ready: boolean;
  checks: ReadinessCheck;
};

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async checkReadiness(): Promise<ReadinessResult> {
    const postgres = await Promise.allSettled([this.prisma.check()]);
    const checks: ReadinessCheck = {
      postgres: postgres[0].status === 'fulfilled' ? 'up' : 'down',
    };
    return {
      ready: Object.values(checks).every((status) => status === 'up'),
      checks,
    };
  }
}
