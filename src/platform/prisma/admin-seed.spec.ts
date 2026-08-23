import { describe, expect, it, vi } from 'vitest';
import { seedAdmin } from './admin-seed';

describe('seedAdmin', () => {
  it('normalizes the configured email and creates an administrator', async () => {
    const userUpsert = vi.fn<Parameters<typeof seedAdmin>[0]['user']['upsert']>(
      ({ create, update, where }) => {
        expect(create.email).toBe('admin@example.com');
        expect(create.emailVerified).toBe(false);
        expect(create.name).toBe('admin@example.com');
        expect(create.role).toBe('ADMIN');
        expect(update).toEqual({ role: 'ADMIN' });
        expect(where).toEqual({ email: 'admin@example.com' });
        return Promise.resolve({ id: 'admin-id' });
      },
    );
    const accountUpsert = vi.fn<
      Parameters<typeof seedAdmin>[0]['account']['upsert']
    >(({ create, update, where }) => {
      expect(create.accountId).toBe('admin-id');
      expect(create.issuer).toBe('local:credential');
      expect(create.password).toBe('encoded-password');
      expect(create.providerId).toBe('credential');
      expect(create.userId).toBe('admin-id');
      expect(update).toEqual({});
      expect(where).toEqual({
        issuer_accountId: {
          accountId: 'admin-id',
          issuer: 'local:credential',
        },
      });
      return Promise.resolve();
    });
    const hashPassword = vi.fn().mockResolvedValue('encoded-password');

    await seedAdmin(
      {
        account: { upsert: accountUpsert },
        user: { upsert: userUpsert },
      },
      ' Admin@Example.COM ',
      'secure-password',
      hashPassword,
    );

    expect(hashPassword).toHaveBeenCalledWith('secure-password');
    expect(accountUpsert).toHaveBeenCalledOnce();
  });

  it('promotes an existing user without resetting its credential', async () => {
    const accountUpsert = vi.fn<
      Parameters<typeof seedAdmin>[0]['account']['upsert']
    >(({ update }) => {
      expect(update).toEqual({});
      return Promise.resolve();
    });
    const userUpsert = vi.fn<Parameters<typeof seedAdmin>[0]['user']['upsert']>(
      ({ update }) => {
        expect(update).toEqual({ role: 'ADMIN' });
        return Promise.resolve({ id: 'existing-user-id' });
      },
    );

    await seedAdmin(
      {
        account: { upsert: accountUpsert },
        user: { upsert: userUpsert },
      },
      'admin@example.com',
      'secure-password',
      vi.fn().mockResolvedValue('encoded-password'),
    );

    expect(userUpsert).toHaveBeenCalledOnce();
    expect(accountUpsert).toHaveBeenCalledOnce();
  });

  it('does not duplicate an existing administrator or credential', async () => {
    const accountUpsert = vi.fn<
      Parameters<typeof seedAdmin>[0]['account']['upsert']
    >(({ update }) => {
      expect(update).toEqual({});
      return Promise.resolve();
    });
    const userUpsert = vi.fn<Parameters<typeof seedAdmin>[0]['user']['upsert']>(
      ({ update }) => {
        expect(update).toEqual({ role: 'ADMIN' });
        return Promise.resolve({ id: 'existing-admin-id' });
      },
    );

    await seedAdmin(
      {
        account: { upsert: accountUpsert },
        user: { upsert: userUpsert },
      },
      'admin@example.com',
      'secure-password',
      vi.fn().mockResolvedValue('encoded-password'),
    );

    expect(userUpsert).toHaveBeenCalledOnce();
    expect(accountUpsert).toHaveBeenCalledOnce();
  });
});
