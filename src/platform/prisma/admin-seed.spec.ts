import { describe, expect, it, vi } from 'vitest';
import { hashSeedPassword, seedAdmin } from './admin-seed';

describe('seedAdmin', () => {
  it('normalizes the configured email and creates an administrator', async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    const hashPassword = vi.fn().mockResolvedValue('encoded-password');

    await seedAdmin(
      {
        user: {
          create,
          findUnique: vi.fn().mockResolvedValue(null),
          update: vi.fn(),
        },
      },
      ' Admin@Example.COM ',
      'secure-password',
      hashPassword,
    );

    expect(hashPassword).toHaveBeenCalledWith('secure-password');
    expect(create).toHaveBeenCalledWith({
      data: {
        email: 'admin@example.com',
        passwordHash: 'encoded-password',
        role: 'ADMIN',
      },
    });
  });

  it('promotes an existing user without resetting its password', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const hashPassword = vi.fn();

    await seedAdmin(
      {
        user: {
          create: vi.fn(),
          findUnique: vi.fn().mockResolvedValue({ role: 'USER' }),
          update,
        },
      },
      'admin@example.com',
      'secure-password',
      hashPassword,
    );

    expect(hashPassword).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      where: { email: 'admin@example.com' },
      data: { role: 'ADMIN' },
    });
  });

  it('does nothing when the user is already an administrator', async () => {
    const create = vi.fn();
    const update = vi.fn();
    const hashPassword = vi.fn();

    await seedAdmin(
      {
        user: {
          create,
          findUnique: vi.fn().mockResolvedValue({ role: 'ADMIN' }),
          update,
        },
      },
      'admin@example.com',
      'secure-password',
      hashPassword,
    );

    expect(hashPassword).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('hashes a seed password with the default argon2 parameters', async () => {
    const hash = await hashSeedPassword('secure-password');

    expect(hash).toMatch(/^\$argon2id\$/);
  });
});
