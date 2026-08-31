import { Injectable } from '@nestjs/common';
import { Role } from '../../generated/prisma/client';
import { PlatformError } from '../../core/errors/platform-error';
import {
  AdminUserPatch,
  ListUsersParams,
  PaginatedUsers,
  PublicUser,
  UsersRepository,
} from './users.repository';

export type { PublicUser } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly users: UsersRepository) {}

  findPublicById(id: string): Promise<PublicUser | null> {
    return this.users.findPublicById(id);
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
