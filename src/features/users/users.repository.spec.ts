import { Prisma, Role } from '../../generated/prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { UsersRepository } from './users.repository';

const publicUser = {
  createdAt: new Date('2026-08-17T00:00:00.000Z'),
  email: 'reader@example.com',
  id: 'user-1',
  role: Role.USER,
  updatedAt: new Date('2026-08-17T00:00:00.000Z'),
};

describe('UsersRepository', () => {
  it('When listing without a search, then it queries without a where filter', async () => {
    const prisma = {
      user: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const repository = new UsersRepository(prisma as never);

    await repository.list({
      limit: 20,
      page: 1,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it('When updating a missing user in a transaction, then it maps to USER_NOT_FOUND', async () => {
    const transaction = {
      user: {
        update: vi.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('not found', {
            clientVersion: '6.0.0',
            code: 'P2025',
          }),
        ),
      },
    };
    const prisma = {
      $transaction: vi.fn((work: (transaction: unknown) => Promise<unknown>) =>
        work(transaction),
      ),
    };
    const repository = new UsersRepository(prisma as never);

    await expect(
      repository.transact((users) =>
        users.updateAdmin('user-1', { email: 'x@y.com' }),
      ),
    ).rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
  });

  it('When updating to a duplicate email in a transaction, then it maps to USER_EMAIL_ALREADY_EXISTS', async () => {
    const transaction = {
      user: {
        update: vi.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('duplicate email', {
            clientVersion: '6.0.0',
            code: 'P2002',
          }),
        ),
      },
    };
    const prisma = {
      $transaction: vi.fn((work: (transaction: unknown) => Promise<unknown>) =>
        work(transaction),
      ),
    };
    const repository = new UsersRepository(prisma as never);

    await expect(
      repository.transact((users) =>
        users.updateAdmin('user-1', { email: 'reader@example.com' }),
      ),
    ).rejects.toMatchObject({ code: 'USER_EMAIL_ALREADY_EXISTS' });
  });

  it('When a transaction fails unexpectedly, then it preserves the original error', async () => {
    const failure = new Error('database unavailable');
    const prisma = {
      $transaction: vi.fn().mockRejectedValue(failure),
    };
    const repository = new UsersRepository(prisma as never);

    await expect(repository.transact(vi.fn())).rejects.toBe(failure);
  });

  it('When resolving the role of an existing user, then it returns it', async () => {
    const transaction = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ role: Role.ADMIN }),
      },
    };
    const prisma = {
      $transaction: vi.fn((work: (transaction: unknown) => Promise<unknown>) =>
        work(transaction),
      ),
    };
    const repository = new UsersRepository(prisma as never);

    const role = await repository.transact((users) => users.findRole('user-1'));

    expect(role).toBe(Role.ADMIN);
    expect(transaction.user.findUnique).toHaveBeenCalledWith({
      select: { role: true },
      where: { id: 'user-1' },
    });
  });

  it('When resolving the role of a missing user, then it returns null', async () => {
    const transaction = {
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };
    const prisma = {
      $transaction: vi.fn((work: (transaction: unknown) => Promise<unknown>) =>
        work(transaction),
      ),
    };
    const repository = new UsersRepository(prisma as never);

    const role = await repository.transact((users) =>
      users.findRole('ghost-user'),
    );

    expect(role).toBeNull();
  });

  it('When updating a role without an email, then it omits the email from the patch', async () => {
    const transaction = {
      user: {
        update: vi.fn().mockResolvedValue({
          ...publicUser,
          role: Role.ADMIN,
        }),
      },
    };
    const prisma = {
      $transaction: vi.fn((work: (transaction: unknown) => Promise<unknown>) =>
        work(transaction),
      ),
    };
    const repository = new UsersRepository(prisma as never);

    await repository.transact((users) =>
      users.updateAdmin('user-1', { role: Role.ADMIN }),
    );

    expect(transaction.user.update).toHaveBeenCalledWith({
      data: { role: Role.ADMIN },
      where: { id: 'user-1' },
    });
  });

  it('When updating an email without a role, then it omits the role from the patch', async () => {
    const transaction = {
      user: {
        update: vi.fn().mockResolvedValue(publicUser),
      },
    };
    const prisma = {
      $transaction: vi.fn((work: (transaction: unknown) => Promise<unknown>) =>
        work(transaction),
      ),
    };
    const repository = new UsersRepository(prisma as never);

    await repository.transact((users) =>
      users.updateAdmin('user-1', { email: 'reader@example.com' }),
    );

    expect(transaction.user.update).toHaveBeenCalledWith({
      data: { email: 'reader@example.com' },
      where: { id: 'user-1' },
    });
  });
});
