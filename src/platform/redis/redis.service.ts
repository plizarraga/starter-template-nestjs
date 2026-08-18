import { ConfigService } from '@nestjs/config';
import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { Environment } from '../config/environment';
import { PlatformError } from '../errors/platform-error';
import { REDIS_CLIENT } from './redis.client';

type AuthenticationSessionCommands = {
  revokeAuthenticationSession(
    sessionKey: string,
    refreshSecretHmac: string,
    sessionId: string,
  ): Promise<number>;
  revokeUserAuthenticationSessions(userSessionsKey: string): Promise<number>;
  rotateAuthenticationSession(
    sessionKey: string,
    presentedRefreshSecretHmac: string,
    replacementRefreshSecretHmac: string,
  ): Promise<[number, string]>;
};

type RateLimitCommands = {
  incrementRateLimit(
    counterKey: string,
    ttlMilliseconds: number,
    limit: number,
  ): Promise<[number, number, number]>;
};

export type RateLimitResult = {
  isBlocked: boolean;
  timeToBlockExpire: number;
  timeToExpire: number;
  totalHits: number;
};

const rotateAuthenticationSessionLua = `
local stored = redis.call('HGET', KEYS[1], 'refreshSecretHmac')
if not stored or string.len(stored) ~= string.len(ARGV[1]) then return {0, ''} end
local difference = 0
for index = 1, string.len(stored) do
  difference = bit.bor(difference, bit.bxor(string.byte(stored, index), string.byte(ARGV[1], index)))
end
if difference ~= 0 then return {0, ''} end
local userId = redis.call('HGET', KEYS[1], 'userId')
redis.call('HSET', KEYS[1], 'refreshSecretHmac', ARGV[2])
return {1, userId}
`;

const revokeAuthenticationSessionLua = `
local stored = redis.call('HGET', KEYS[1], 'refreshSecretHmac')
if not stored or string.len(stored) ~= string.len(ARGV[1]) then return 0 end
local difference = 0
for index = 1, string.len(stored) do
  difference = bit.bor(difference, bit.bxor(string.byte(stored, index), string.byte(ARGV[1], index)))
end
if difference ~= 0 then return 0 end
local userId = redis.call('HGET', KEYS[1], 'userId')
redis.call('DEL', KEYS[1])
if userId then redis.call('SREM', 'auth:user-sessions:' .. userId, ARGV[2]) end
return 1
`;

const revokeUserAuthenticationSessionsLua = `
local sessionIds = redis.call('SMEMBERS', KEYS[1])
for _, sessionId in ipairs(sessionIds) do
  redis.call('DEL', 'auth:session:' .. sessionId)
end
return redis.call('DEL', KEYS[1])
`;

const incrementRateLimitLua = `
local totalHits = redis.call('INCR', KEYS[1])
if totalHits == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local timeToExpire = redis.call('PTTL', KEYS[1])
if timeToExpire < 0 then
  timeToExpire = tonumber(ARGV[1])
end
if totalHits > tonumber(ARGV[2]) then
  return {totalHits, timeToExpire, 1}
end
return {totalHits, timeToExpire, 0}
`;

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(
    @Inject(REDIS_CLIENT) private readonly client: Redis,
    private readonly config: ConfigService<Environment, true>,
  ) {
    this.client.defineCommand('rotateAuthenticationSession', {
      lua: rotateAuthenticationSessionLua,
      numberOfKeys: 1,
    });
    this.client.defineCommand('revokeAuthenticationSession', {
      lua: revokeAuthenticationSessionLua,
      numberOfKeys: 1,
    });
    this.client.defineCommand('revokeUserAuthenticationSessions', {
      lua: revokeUserAuthenticationSessionsLua,
      numberOfKeys: 1,
    });
    this.client.defineCommand('incrementRateLimit', {
      lua: incrementRateLimitLua,
      numberOfKeys: 1,
    });
  }

  async createAuthenticationSession(
    userId: string,
    sessionId: string,
    refreshSecretHmac: string,
  ): Promise<void> {
    const ttlSeconds = this.config.getOrThrow('REFRESH_TOKEN_TTL_DAYS') * 86400;
    const sessionKey = `auth:session:${sessionId}`;

    try {
      await this.connectIfNeeded();
      const results = await this.client
        .multi()
        .hset(
          sessionKey,
          'createdAt',
          new Date().toISOString(),
          'expiresAt',
          new Date(Date.now() + ttlSeconds * 1000).toISOString(),
          'refreshSecretHmac',
          refreshSecretHmac,
          'userId',
          userId,
        )
        .expire(sessionKey, ttlSeconds)
        .sadd(`auth:user-sessions:${userId}`, sessionId)
        .expire(`auth:user-sessions:${userId}`, ttlSeconds)
        .exec();
      if (results === null || results.some(([error]) => error != null)) {
        throw new Error('Redis session transaction failed');
      }
    } catch {
      throw new PlatformError('SERVICE_UNAVAILABLE');
    }
  }

  async rotateAuthenticationSession(
    sessionId: string,
    presentedRefreshSecretHmac: string,
    replacementRefreshSecretHmac: string,
  ): Promise<string | null> {
    try {
      await this.connectIfNeeded();
      const [rotated, userId] = await (
        this.client as Redis & AuthenticationSessionCommands
      ).rotateAuthenticationSession(
        `auth:session:${sessionId}`,
        presentedRefreshSecretHmac,
        replacementRefreshSecretHmac,
      );
      return rotated === 1 ? userId : null;
    } catch {
      throw new PlatformError('SERVICE_UNAVAILABLE');
    }
  }

  async revokeAuthenticationSession(
    sessionId: string,
    refreshSecretHmac: string,
  ): Promise<void> {
    try {
      await this.connectIfNeeded();
      await (
        this.client as Redis & AuthenticationSessionCommands
      ).revokeAuthenticationSession(
        `auth:session:${sessionId}`,
        refreshSecretHmac,
        sessionId,
      );
    } catch {
      throw new PlatformError('SERVICE_UNAVAILABLE');
    }
  }

  async revokeUserAuthenticationSessions(userId: string): Promise<void> {
    try {
      await this.connectIfNeeded();
      await (
        this.client as Redis & AuthenticationSessionCommands
      ).revokeUserAuthenticationSessions(`auth:user-sessions:${userId}`);
    } catch {
      throw new PlatformError('SERVICE_UNAVAILABLE');
    }
  }

  async incrementRateLimit(
    counterKey: string,
    ttlMilliseconds: number,
    limit: number,
  ): Promise<RateLimitResult> {
    try {
      await this.connectIfNeeded();
      const [totalHits, timeToExpireMs, blocked] = await (
        this.client as Redis & RateLimitCommands
      ).incrementRateLimit(
        `rate-limit:${counterKey}`,
        ttlMilliseconds,
        limit,
      );
      const timeToExpire = Math.ceil(timeToExpireMs / 1000);
      return {
        isBlocked: blocked === 1,
        timeToBlockExpire: blocked === 1 ? timeToExpire : 0,
        timeToExpire,
        totalHits,
      };
    } catch {
      throw new PlatformError('SERVICE_UNAVAILABLE');
    }
  }

  async check(): Promise<void> {
    try {
      await this.connectIfNeeded();
      await this.client.ping();
    } catch {
      throw new PlatformError('SERVICE_UNAVAILABLE');
    }
  }

  private async connectIfNeeded(): Promise<void> {
    if (this.client.status === 'wait' || this.client.status === 'end') {
      await this.client.connect();
    }
  }

  onModuleDestroy(): void {
    this.client.disconnect();
  }
}
