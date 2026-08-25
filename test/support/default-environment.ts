export const defaultEnvironment: NodeJS.ProcessEnv = {
  BETTER_AUTH_SECRET: 'test-better-auth-secret-that-is-long-enough',
  CORS_ORIGINS: 'http://localhost:3001',
  DATABASE_SCHEMA: 'public',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/starter',
  DEPLOYMENT_TOPOLOGY: 'same-site',
  LOG_LEVEL: 'silent',
  NODE_ENV: 'test',
  PORT: '3000',
  PUBLIC_BASE_URL: 'http://localhost:3000',
  RATE_LIMIT_LOGIN_MAX: '1000',
  RATE_LIMIT_LOGIN_TTL_SECONDS: '900',
  RATE_LIMIT_REGISTER_MAX: '1000',
  RATE_LIMIT_REGISTER_TTL_SECONDS: '3600',
};

Object.assign(process.env, defaultEnvironment);
