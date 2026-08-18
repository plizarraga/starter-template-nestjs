import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { describe, expect, it } from 'vitest';
import { UpdateProfileDto } from './update-profile.dto';

describe('UpdateProfileDto', () => {
  it('When email is a string, then it is trimmed and lowercased', () => {
    const dto = plainToInstance(UpdateProfileDto, {
      email: ' Reader@Example.com ',
      currentPassword: 'password-123',
    });

    expect(dto.email).toBe('reader@example.com');
  });

  it('When email is not a string, then it passes through unchanged', () => {
    const dto = plainToInstance(UpdateProfileDto, {
      email: true,
      currentPassword: 'password-123',
    });

    expect(dto.email).toBe(true);
  });
});
