import { describe, expect, it } from 'vitest';
import { validateEnvironment } from './environment';

describe('validateEnvironment', () => {
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
