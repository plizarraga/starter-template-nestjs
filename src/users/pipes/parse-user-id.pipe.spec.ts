import { describe, expect, it } from 'vitest';
import { ParseUserIdPipe } from './parse-user-id.pipe';

describe('ParseUserIdPipe', () => {
  it('When a user ID is a non-empty opaque string, then it preserves the ID', () => {
    const pipe = new ParseUserIdPipe();

    expect(pipe.transform('L4XzvY7pQa')).toBe('L4XzvY7pQa');
  });

  it('When a user ID is empty or whitespace, then it rejects the parameter', () => {
    const pipe = new ParseUserIdPipe();

    expect(() => pipe.transform('   ')).toThrow('Validation failed');
  });
});
