import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { describe, expect, it } from 'vitest';
import { ListUsersQueryDto } from './list-users-query.dto';

describe('ListUsersQueryDto', () => {
  it('When search is a string, then it is trimmed and lowercased', () => {
    const dto = plainToInstance(ListUsersQueryDto, {
      search: ' Reader@Example.com ',
    });

    expect(dto.search).toBe('reader@example.com');
  });

  it('When search is not a string, then it passes through unchanged', () => {
    const dto = plainToInstance(ListUsersQueryDto, { search: 123 });

    expect(dto.search).toBe(123);
  });
});
