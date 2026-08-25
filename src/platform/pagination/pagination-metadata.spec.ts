import { describe, expect, it } from 'vitest';
import { buildPaginationMeta } from './pagination-metadata';

describe('buildPaginationMeta', () => {
  it.each([
    [
      'an empty result',
      { limit: 20, page: 1, total: 0 },
      {
        hasNextPage: false,
        hasPreviousPage: false,
        limit: 20,
        page: 1,
        total: 0,
        totalPages: 0,
      },
    ],
    [
      'a single page',
      { limit: 20, page: 1, total: 1 },
      {
        hasNextPage: false,
        hasPreviousPage: false,
        limit: 20,
        page: 1,
        total: 1,
        totalPages: 1,
      },
    ],
    [
      'an exact multiple of the limit',
      { limit: 20, page: 2, total: 40 },
      {
        hasNextPage: false,
        hasPreviousPage: true,
        limit: 20,
        page: 2,
        total: 40,
        totalPages: 2,
      },
    ],
    [
      'a page beyond the final page',
      { limit: 20, page: 3, total: 40 },
      {
        hasNextPage: false,
        hasPreviousPage: true,
        limit: 20,
        page: 3,
        total: 40,
        totalPages: 2,
      },
    ],
  ])(
    'When given %s, then it builds the expected metadata',
    (_, input, expected) => {
      expect(buildPaginationMeta(input.total, input.page, input.limit)).toEqual(
        expected,
      );
    },
  );
});
