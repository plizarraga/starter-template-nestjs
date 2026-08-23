import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
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

  it('When page is not an integer, then it is rejected', async () => {
    const dto = plainToInstance(ListUsersQueryDto, { page: '1.5' });

    const errors = await validate(dto);

    expect(dto.page).toBe(1.5);
    expect(errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'page' })]),
    );
  });

  it('When limit exceeds the maximum, then it is rejected', async () => {
    const dto = plainToInstance(ListUsersQueryDto, { limit: '101' });

    const errors = await validate(dto);

    expect(dto.limit).toBe(101);
    expect(errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'limit' })]),
    );
  });
});
