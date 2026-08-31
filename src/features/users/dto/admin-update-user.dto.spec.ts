import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { describe, expect, it } from 'vitest';
import { AdminUpdateUserDto } from './admin-update-user.dto';

describe('AdminUpdateUserDto', () => {
  it('When email is a string, then it is trimmed and lowercased', () => {
    const dto = plainToInstance(AdminUpdateUserDto, {
      email: ' Admin@Example.com ',
    });

    expect(dto.email).toBe('admin@example.com');
  });

  it('When email is not a string, then it passes through unchanged', () => {
    const dto = plainToInstance(AdminUpdateUserDto, { email: 42 });

    expect(dto.email).toBe(42);
  });
});
