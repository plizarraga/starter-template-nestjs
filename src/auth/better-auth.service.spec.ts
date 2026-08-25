import { describe, expect, it } from 'vitest';
import { deriveCookieAttributes } from './better-auth.service';

describe('deriveCookieAttributes', () => {
  it('When the topology is same-site outside production, then the cookie is Lax and not Secure', () => {
    expect(deriveCookieAttributes('same-site', 'development')).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
    });
  });

  it('When the topology is same-site in production, then the cookie is Lax and Secure', () => {
    expect(deriveCookieAttributes('same-site', 'production')).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
    });
  });

  it('When the topology is cross-site, then the cookie is None, Secure, and Partitioned regardless of environment', () => {
    expect(deriveCookieAttributes('cross-site', 'development')).toEqual({
      httpOnly: true,
      partitioned: true,
      sameSite: 'none',
      secure: true,
    });
    expect(deriveCookieAttributes('cross-site', 'production')).toEqual({
      httpOnly: true,
      partitioned: true,
      sameSite: 'none',
      secure: true,
    });
  });
});
