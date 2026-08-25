import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { PaginationQueryDto } from './pagination-query.dto';

describe('PaginationQueryDto', () => {
  it('When no query values are supplied, then it defaults to the first page of twenty items', () => {
    const dto = plainToInstance(PaginationQueryDto, {});

    expect(dto).toMatchObject({ limit: 20, page: 1 });
  });

  it('When page is not an integer, then it is rejected', async () => {
    const dto = plainToInstance(PaginationQueryDto, { page: '1.5' });

    const errors = await validate(dto);

    expect(errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'page' })]),
    );
  });

  it('When limit exceeds the maximum, then it is rejected', async () => {
    const dto = plainToInstance(PaginationQueryDto, { limit: '101' });

    const errors = await validate(dto);

    expect(errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'limit' })]),
    );
  });
});
