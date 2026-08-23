import { Injectable } from '@nestjs/common';
import { Role, User } from '../generated/prisma/client';
import { PlatformError } from '../platform/errors/platform-error';
import {
  AdminUserPatch,
  ListUsersParams,
  PaginatedUsers,
  PublicUser,
  UsersRepository,
  UserTransaction,
} from './users.repository';

export type { PublicUser } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly users: UsersRepository) {}

  findById(id: string): Promise<Pick<User, 'id' | 'role'> | null> {
    return this.users.findById(id);
  }

  findPublicById(id: string): Promise<PublicUser | null> {
    return this.users.findPublicById(id);
  }

  transact<T>(work: (users: UserTransaction) => Promise<T>): Promise<T> {
    return this.users.transact(work);
  }

  list(params: ListUsersParams): Promise<PaginatedUsers> {
    return this.users.list(params);
  }

  async updateAdmin(
    actingAdminId: string,
    targetId: string,
    patch: AdminUserPatch,
  ): Promise<PublicUser> {
    if (actingAdminId === targetId && patch.role === Role.USER) {
      throw new PlatformError('CANNOT_REMOVE_OWN_ADMIN_ROLE');
    }
    return this.users.transact(async (users) => {
      if (patch.role === Role.USER) {
        const currentRole = await users.findRole(targetId);
        if (currentRole === null) {
          throw new PlatformError('USER_NOT_FOUND');
        }
        if (currentRole === Role.ADMIN) {
          const remainingAdmins = await users.countAdmins();
          if (remainingAdmins <= 1) {
            throw new PlatformError('CANNOT_REMOVE_LAST_ADMIN');
          }
        }
      }
      return users.updateAdmin(targetId, patch);
    });
  }
}
