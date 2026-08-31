import { Role } from '../../generated/prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { UsersController } from './users.controller';

describe('UsersController', () => {
  it('When the current user no longer exists, then me rejects with USER_NOT_FOUND', async () => {
    const users = { findPublicById: vi.fn().mockResolvedValue(null) };
    const controller = new UsersController(users as never);

    await expect(
      controller.me({ principal: { id: 'ghost', role: Role.USER } } as never),
    ).rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
  });

  it('When a principal is missing, then it rejects as unauthorized', async () => {
    const users = { findPublicById: vi.fn() };
    const controller = new UsersController(users as never);

    await expect(controller.me({} as never)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect(users.findPublicById).not.toHaveBeenCalled();
  });

  it('When the current user exists, then me returns the profile', async () => {
    const profile = {
      createdAt: new Date(),
      email: 'reader@example.com',
      id: 'user-1',
      role: Role.USER,
      updatedAt: new Date(),
    };
    const users = { findPublicById: vi.fn().mockResolvedValue(profile) };
    const controller = new UsersController(users as never);

    const result = await controller.me({
      principal: { id: 'user-1', role: Role.USER },
    } as never);

    expect(result).toBe(profile);
  });

  it('When listing users, then it maps the HTTP query to the service contract', () => {
    const users = { list: vi.fn() };
    const controller = new UsersController(users as never);
    const query = {
      ignored: 'request-only value',
      limit: 50,
      page: 2,
      search: 'reader@example.com',
      sortBy: 'email' as const,
      sortOrder: 'asc' as const,
    };

    void controller.list(query);

    expect(users.list).toHaveBeenCalledWith({
      limit: query.limit,
      page: query.page,
      search: query.search,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });
  });

  it('When fetching a missing user by id, then it rejects with USER_NOT_FOUND', async () => {
    const users = { findPublicById: vi.fn().mockResolvedValue(null) };
    const controller = new UsersController(users as never);

    await expect(controller.getById('user-2')).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
    });
  });
});
