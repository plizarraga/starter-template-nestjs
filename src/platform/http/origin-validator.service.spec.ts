import { describe, expect, it, vi } from 'vitest';
import { PlatformError } from '../errors/platform-error';
import { OriginValidator } from './origin-validator.service';

const config = {
  getOrThrow: vi
    .fn()
    .mockReturnValue('http://localhost:3001, http://localhost:3002'),
} as never;

describe('OriginValidator', () => {
  it('When the origin is whitelisted, then it allows the request', () => {
    const validator = new OriginValidator(config);

    expect(() =>
      validator.requireAllowed('http://localhost:3002'),
    ).not.toThrow();
  });

  it('When the origin is missing, then it rejects', () => {
    const validator = new OriginValidator(config);

    expect(() => validator.requireAllowed(undefined)).toThrowError(
      new PlatformError('FORBIDDEN'),
    );
  });

  it('When the origin is not a string, then it rejects', () => {
    const validator = new OriginValidator(config);

    expect(() =>
      validator.requireAllowed(['http://localhost:3001'] as never),
    ).toThrowError(new PlatformError('FORBIDDEN'));
  });

  it('When the origin is not whitelisted, then it rejects', () => {
    const validator = new OriginValidator(config);

    expect(() =>
      validator.requireAllowed('http://evil.example.com'),
    ).toThrowError(new PlatformError('FORBIDDEN'));
  });
});
