import { describe, expect, it } from 'vitest';
import { validateEnvironment } from './environment';

describe('validateEnvironment', () => {
  it('When starter route rate limits are omitted, then they use safe defaults', () => {
    const environment = { ...process.env };
    delete environment.RATE_LIMIT_MAX;
    delete environment.RATE_LIMIT_TTL_SECONDS;

    const result = validateEnvironment(environment);

    expect(result.RATE_LIMIT_MAX).toBe(100);
    expect(result.RATE_LIMIT_TTL_SECONDS).toBe(60);
  });

  it('When a starter route rate limit is not positive, then application initialization fails', () => {
    expect(() =>
      validateEnvironment({
        ...process.env,
        RATE_LIMIT_MAX: '0',
        RATE_LIMIT_TTL_SECONDS: '0',
      }),
    ).toThrow(/RATE_LIMIT_(MAX|TTL_SECONDS)/);
  });

  it('When TRUST_PROXY_HOPS is omitted, then it defaults to a single proxy hop', () => {
    const environment = { ...process.env };
    delete environment.TRUST_PROXY_HOPS;

    const result = validateEnvironment(environment);

    expect(result.TRUST_PROXY_HOPS).toBe(1);
  });

  it('When TRUST_PROXY_HOPS is zero, then the API is accepted as directly exposed', () => {
    const result = validateEnvironment({
      ...process.env,
      TRUST_PROXY_HOPS: '0',
    });

    expect(result.TRUST_PROXY_HOPS).toBe(0);
  });

  it('When TRUST_PROXY_HOPS is negative, then application initialization fails', () => {
    expect(() =>
      validateEnvironment({ ...process.env, TRUST_PROXY_HOPS: '-1' }),
    ).toThrow('TRUST_PROXY_HOPS');
  });

  it('When DEPLOYMENT_TOPOLOGY is omitted, then it defaults to same-site', () => {
    const environment = { ...process.env };
    delete environment.DEPLOYMENT_TOPOLOGY;

    const result = validateEnvironment(environment);

    expect(result.DEPLOYMENT_TOPOLOGY).toBe('same-site');
  });

  it('When PUBLIC_BASE_URL is missing, then application initialization fails', () => {
    const environment = { ...process.env };
    delete environment.PUBLIC_BASE_URL;

    expect(() => validateEnvironment(environment)).toThrow('PUBLIC_BASE_URL');
  });

  it('When PUBLIC_BASE_URL is not an absolute http/https URL, then application initialization fails', () => {
    const environment = {
      ...process.env,
      PUBLIC_BASE_URL: 'not-a-url',
    };

    expect(() => validateEnvironment(environment)).toThrow('PUBLIC_BASE_URL');
  });

  it('When DEPLOYMENT_TOPOLOGY is cross-site with a non-https PUBLIC_BASE_URL, then application initialization fails naming the combination', () => {
    const environment = {
      ...process.env,
      DEPLOYMENT_TOPOLOGY: 'cross-site',
      PUBLIC_BASE_URL: 'http://api.example.com',
    };

    expect(() => validateEnvironment(environment)).toThrow(
      'DEPLOYMENT_TOPOLOGY=cross-site requires an https PUBLIC_BASE_URL',
    );
  });

  it('When NODE_ENV is production with a non-https PUBLIC_BASE_URL, then application initialization fails naming the combination', () => {
    const environment = {
      ...process.env,
      NODE_ENV: 'production',
      PUBLIC_BASE_URL: 'http://api.example.com',
    };

    expect(() => validateEnvironment(environment)).toThrow(
      'NODE_ENV=production requires an https PUBLIC_BASE_URL',
    );
  });

  it('When DEPLOYMENT_TOPOLOGY is cross-site with an https PUBLIC_BASE_URL, then application initialization succeeds', () => {
    const environment = {
      ...process.env,
      DEPLOYMENT_TOPOLOGY: 'cross-site',
      PUBLIC_BASE_URL: 'https://api.example.com',
    };

    expect(() => validateEnvironment(environment)).not.toThrow();
  });
});
