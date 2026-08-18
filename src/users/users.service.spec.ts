import { Role } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { UsersService } from './users.service';

describe('UsersService', () => {
  it('When listing users, then it delegates the validated query to the repository', async () => {
    const paginated = {
      data: [],
      meta: {
        hasNextPage: false,
        hasPreviousPage: false,
        limit: 20,
        page: 1,
        total: 0,
        totalPages: 0,
      },
    };
    const users = { list: vi.fn().mockResolvedValue(paginated) };
    const service = new UsersService(users as never);

    const query = {
      limit: 20,
      page: 1,
      sortBy: 'createdAt' as const,
      sortOrder: 'desc' as const,
    };
    const result = await service.list(query);

    expect(users.list).toHaveBeenCalledWith(query);
    expect(result).toBe(paginated);
  });

  it('When an administrator changes a target that stays non-ADMIN, then it persists without checking the admin count', async () => {
    const updated = {
      createdAt: new Date(),
      email: 'target@example.com',
      id: 'user-2',
      role: Role.USER,
      updatedAt: new Date(),
    };
    const transaction = {
      countAdmins: vi.fn(),
      findRole: vi.fn(),
      updateAdmin: vi.fn().mockResolvedValue(updated),
    };
    const users = {
      transact: vi.fn((work: (users: typeof transaction) => Promise<unknown>) =>
        work(transaction),
      ),
    };
    const service = new UsersService(users as never);

    const result = await service.updateAdmin('admin-1', 'user-2', {
      email: 'target@example.com',
    });

    expect(transaction.findRole).not.toHaveBeenCalled();
    expect(transaction.updateAdmin).toHaveBeenCalledWith('user-2', {
      email: 'target@example.com',
    });
    expect(result).toBe(updated);
  });

  it('When an administrator demotes another administrator while other administrators remain, then it persists', async () => {
    const updated = {
      createdAt: new Date(),
      email: 'target@example.com',
      id: 'user-2',
      role: Role.USER,
      updatedAt: new Date(),
    };
    const transaction = {
      countAdmins: vi.fn().mockResolvedValue(2),
      findRole: vi.fn().mockResolvedValue(Role.ADMIN),
      updateAdmin: vi.fn().mockResolvedValue(updated),
    };
    const users = {
      transact: vi.fn((work: (users: typeof transaction) => Promise<unknown>) =>
        work(transaction),
      ),
    };
    const service = new UsersService(users as never);

    const result = await service.updateAdmin('admin-1', 'user-2', {
      role: Role.USER,
    });

    expect(transaction.countAdmins).toHaveBeenCalled();
    expect(transaction.updateAdmin).toHaveBeenCalledWith('user-2', {
      role: Role.USER,
    });
    expect(result).toBe(updated);
  });

  it('When demoting the last remaining administrator, then it rejects without persisting', async () => {
    const transaction = {
      countAdmins: vi.fn().mockResolvedValue(1),
      findRole: vi.fn().mockResolvedValue(Role.ADMIN),
      updateAdmin: vi.fn(),
    };
    const users = {
      transact: vi.fn((work: (users: typeof transaction) => Promise<unknown>) =>
        work(transaction),
      ),
    };
    const service = new UsersService(users as never);

    await expect(
      service.updateAdmin('admin-1', 'user-2', { role: Role.USER }),
    ).rejects.toMatchObject({ code: 'CANNOT_REMOVE_LAST_ADMIN' });
    expect(transaction.updateAdmin).not.toHaveBeenCalled();
  });

  it('When the target of a demotion does not exist, then it rejects with USER_NOT_FOUND', async () => {
    const transaction = {
      countAdmins: vi.fn(),
      findRole: vi.fn().mockResolvedValue(null),
      updateAdmin: vi.fn(),
    };
    const users = {
      transact: vi.fn((work: (users: typeof transaction) => Promise<unknown>) =>
        work(transaction),
      ),
    };
    const service = new UsersService(users as never);

    await expect(
      service.updateAdmin('admin-1', 'user-2', { role: Role.USER }),
    ).rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
    expect(transaction.countAdmins).not.toHaveBeenCalled();
    expect(transaction.updateAdmin).not.toHaveBeenCalled();
  });

  it('When an administrator demotes a non-administrator, then it persists without counting administrators', async () => {
    const updated = {
      createdAt: new Date(),
      email: 'target@example.com',
      id: 'user-2',
      role: Role.USER,
      updatedAt: new Date(),
    };
    const transaction = {
      countAdmins: vi.fn(),
      findRole: vi.fn().mockResolvedValue(Role.USER),
      updateAdmin: vi.fn().mockResolvedValue(updated),
    };
    const users = {
      transact: vi.fn((work: (users: typeof transaction) => Promise<unknown>) =>
        work(transaction),
      ),
    };
    const service = new UsersService(users as never);

    const result = await service.updateAdmin('admin-1', 'user-2', {
      role: Role.USER,
    });

    expect(transaction.findRole).toHaveBeenCalledWith('user-2');
    expect(transaction.countAdmins).not.toHaveBeenCalled();
    expect(transaction.updateAdmin).toHaveBeenCalledWith('user-2', {
      role: Role.USER,
    });
    expect(result).toBe(updated);
  });

  it('When an administrator tries to remove their own ADMIN role, then it rejects without touching the repository', async () => {
    const users = { transact: vi.fn() };
    const service = new UsersService(users as never);

    await expect(
      service.updateAdmin('admin-1', 'admin-1', { role: Role.USER }),
    ).rejects.toMatchObject({ code: 'CANNOT_REMOVE_OWN_ADMIN_ROLE' });
    expect(users.transact).not.toHaveBeenCalled();
  });

  it('When an administrator updates their own email without changing role, then it delegates normally', async () => {
    const updated = {
      createdAt: new Date(),
      email: 'admin@example.com',
      id: 'admin-1',
      role: Role.ADMIN,
      updatedAt: new Date(),
    };
    const transaction = {
      countAdmins: vi.fn(),
      findRole: vi.fn(),
      updateAdmin: vi.fn().mockResolvedValue(updated),
    };
    const users = {
      transact: vi.fn((work: (users: typeof transaction) => Promise<unknown>) =>
        work(transaction),
      ),
    };
    const service = new UsersService(users as never);

    await service.updateAdmin('admin-1', 'admin-1', {
      email: 'admin@example.com',
    });

    expect(transaction.updateAdmin).toHaveBeenCalledWith('admin-1', {
      email: 'admin@example.com',
    });
  });
});
