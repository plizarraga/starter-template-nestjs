export const defaultEnvironment: NodeJS.ProcessEnv = {
  ACCESS_TOKEN_TTL_SECONDS: '600',
  COOKIE_NAME: 'refresh_token',
  CORS_ORIGINS: 'http://localhost:3001',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/starter',
  JWT_AUDIENCE: 'starter-client',
  JWT_ISSUER: 'starter-api',
  JWT_SECRET: 'test-jwt-secret-that-is-long-enough',
  LOG_LEVEL: 'silent',
  NODE_ENV: 'test',
  PORT: '3000',
  REDIS_URL: 'redis://localhost:6379',
  REFRESH_TOKEN_HMAC_SECRET: 'test-refresh-secret-that-is-long-enough',
  REFRESH_TOKEN_TTL_DAYS: '30',
};

Object.assign(process.env, defaultEnvironment);
