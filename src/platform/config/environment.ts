import Joi from 'joi';

export type DeploymentTopology = 'same-site' | 'cross-site';

export type Environment = {
  BETTER_AUTH_SECRET: string;
  CORS_ORIGINS: string;
  DATABASE_SCHEMA: string;
  DATABASE_URL: string;
  DEPLOYMENT_TOPOLOGY: DeploymentTopology;
  LOG_LEVEL: string;
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  PUBLIC_BASE_URL: string;
  RATE_LIMIT_LOGIN_MAX: number;
  RATE_LIMIT_LOGIN_TTL_SECONDS: number;
  RATE_LIMIT_REGISTER_MAX: number;
  RATE_LIMIT_REGISTER_TTL_SECONDS: number;
};

const environmentSchema = Joi.object<Environment>({
  BETTER_AUTH_SECRET: Joi.string().min(32).required(),
  CORS_ORIGINS: Joi.string().trim().required(),
  DATABASE_SCHEMA: Joi.string().trim().default('public'),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .required(),
  DEPLOYMENT_TOPOLOGY: Joi.string()
    .valid('same-site', 'cross-site')
    .default('same-site'),
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
  PUBLIC_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .required(),
  RATE_LIMIT_LOGIN_MAX: Joi.number().integer().positive().default(10),
  RATE_LIMIT_LOGIN_TTL_SECONDS: Joi.number().integer().positive().default(900),
  RATE_LIMIT_REGISTER_MAX: Joi.number().integer().positive().default(5),
  RATE_LIMIT_REGISTER_TTL_SECONDS: Joi.number()
    .integer()
    .positive()
    .default(3600),
}).unknown(true);

function assertSecurePublicBaseUrl(env: Environment): void {
  if (new URL(env.PUBLIC_BASE_URL).protocol === 'https:') {
    return;
  }
  if (env.DEPLOYMENT_TOPOLOGY === 'cross-site') {
    throw new Error(
      'Invalid environment: DEPLOYMENT_TOPOLOGY=cross-site requires an https PUBLIC_BASE_URL, because browsers reject SameSite=None cookies issued over an insecure origin',
    );
  }
  if (env.NODE_ENV === 'production') {
    throw new Error(
      'Invalid environment: NODE_ENV=production requires an https PUBLIC_BASE_URL',
    );
  }
}

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

  assertSecurePublicBaseUrl(result.value);

  return result.value;
}
