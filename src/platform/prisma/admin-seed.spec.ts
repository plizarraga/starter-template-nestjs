import { describe, expect, it, vi } from 'vitest';
import { seedAdmin } from './admin-seed';

describe('seedAdmin', () => {
  it('normalizes the configured email and creates an administrator', async () => {
    const upsert = vi.fn().mockResolvedValue(undefined);
    const hashPassword = vi.fn().mockResolvedValue('encoded-password');

    await seedAdmin(
      { user: { upsert } },
      ' Admin@Example.COM ',
      'secure-password',
      hashPassword,
    );

    expect(hashPassword).toHaveBeenCalledWith('secure-password');
    expect(upsert).toHaveBeenCalledWith({
      where: { email: 'admin@example.com' },
      update: { passwordHash: 'encoded-password', role: 'ADMIN' },
      create: {
        email: 'admin@example.com',
        passwordHash: 'encoded-password',
        role: 'ADMIN',
      },
    });
  });
});
