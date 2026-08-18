import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { describe, expect, it } from 'vitest';
import { CredentialsDto } from './credentials.dto';

describe('CredentialsDto', () => {
  it('When email is a string, then it is trimmed and lowercased', () => {
    const dto = plainToInstance(CredentialsDto, {
      email: ' Reader@Example.com ',
      password: 'password-123',
    });

    expect(dto.email).toBe('reader@example.com');
  });

  it('When email is not a string, then it passes through unchanged', () => {
    const dto = plainToInstance(CredentialsDto, {
      email: 123,
      password: 'password-123',
    });

    expect(dto.email).toBe(123);
  });
});
