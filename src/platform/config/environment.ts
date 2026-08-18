import Joi from 'joi';

export type Environment = {
  ACCESS_TOKEN_TTL_SECONDS: number;
  ARGON2_MEMORY_COST: number;
  ARGON2_PARALLELISM: number;
  ARGON2_TIME_COST: number;
  COOKIE_NAME: string;
  CORS_ORIGINS: string;
  DATABASE_SCHEMA: string;
  DATABASE_URL: string;
  JWT_AUDIENCE: string;
  JWT_ISSUER: string;
  JWT_SECRET: string;
  LOG_LEVEL: string;
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  REDIS_URL: string;
  REFRESH_TOKEN_HMAC_SECRET: string;
  REFRESH_TOKEN_TTL_DAYS: number;
  RATE_LIMIT_LOGIN_MAX: number;
  RATE_LIMIT_LOGIN_TTL_SECONDS: number;
  RATE_LIMIT_REFRESH_MAX: number;
  RATE_LIMIT_REFRESH_TTL_SECONDS: number;
  RATE_LIMIT_REGISTER_MAX: number;
  RATE_LIMIT_REGISTER_TTL_SECONDS: number;
};

const environmentSchema = Joi.object<Environment>({
  // 10 minutes (10 * 60 = 600s) — see docs/EDD.md §S4-S5: this is the max
  // stale-authorization window, since access tokens verify locally with no
  // per-request Redis/Postgres lookup.
  ACCESS_TOKEN_TTL_SECONDS: Joi.number()
    .integer()
    .positive()
    .default(10 * 60),
  ARGON2_MEMORY_COST: Joi.number().integer().positive().default(65536),
  ARGON2_PARALLELISM: Joi.number().integer().positive().default(4),
  ARGON2_TIME_COST: Joi.number().integer().positive().default(3),
  COOKIE_NAME: Joi.string().trim().default('refresh_token'),
  CORS_ORIGINS: Joi.string().trim().required(),
  DATABASE_SCHEMA: Joi.string().trim().default('public'),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .required(),
  JWT_AUDIENCE: Joi.string().trim().required(),
  JWT_ISSUER: Joi.string().trim().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  LOG_LEVEL: Joi.when('NODE_ENV', {
    is: 'production',
    otherwise: Joi.string()
      .valid('trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent')
      .default('debug'),
    then: Joi.string()
      .valid('trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent')
      .default('info'),
  }),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
  PORT: Joi.number().integer().port().default(3000),
  REDIS_URL: Joi.string()
    .uri({ scheme: ['redis', 'rediss'] })
    .required(),
  REFRESH_TOKEN_HMAC_SECRET: Joi.string().min(32).required(),
  REFRESH_TOKEN_TTL_DAYS: Joi.number().integer().positive().default(30),
  RATE_LIMIT_LOGIN_MAX: Joi.number().integer().positive().default(10),
  RATE_LIMIT_LOGIN_TTL_SECONDS: Joi.number().integer().positive().default(900),
  RATE_LIMIT_REFRESH_MAX: Joi.number().integer().positive().default(30),
  RATE_LIMIT_REFRESH_TTL_SECONDS: Joi.number()
    .integer()
    .positive()
    .default(900),
  RATE_LIMIT_REGISTER_MAX: Joi.number().integer().positive().default(5),
  RATE_LIMIT_REGISTER_TTL_SECONDS: Joi.number()
    .integer()
    .positive()
    .default(3600),
}).unknown(true);

export function validateEnvironment(
  config: Record<string, unknown>,
): Environment {
  const result = environmentSchema.validate(config, {
    abortEarly: false,
    convert: true,
  });

  if (result.error !== undefined) {
    throw result.error;
  }

  return result.value;
}
