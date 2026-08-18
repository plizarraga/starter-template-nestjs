import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RedisService } from '../platform/redis/redis.service';

@Injectable()
export class AuthSessionRepository {
  constructor(private readonly redis: RedisService) {}

  async create(userId: string): Promise<string> {
    const sessionId = randomUUID();
    await this.redis.createAuthenticationSession(userId, sessionId);
    return sessionId;
  }
}
