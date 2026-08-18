import { Injectable } from '@nestjs/common';
import { Prisma, Role, User } from '../generated/prisma/client';
import { PlatformError } from '../platform/errors/platform-error';
import { PrismaService } from '../platform/prisma/prisma.service';
import { SortField, SortOrder } from './dto/list-users-query.dto';

export type PublicUser = Omit<User, 'passwordHash'>;

export type UserTransaction = {
  countAdmins(): Promise<number>;
  findRole(id: string): Promise<Role | null>;
  updateAdmin(id: string, patch: AdminUserPatch): Promise<PublicUser>;
  updateEmail(id: string, email: string): Promise<PublicUser>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
};

export type ListUsersParams = {
  limit: number;
  page: number;
  search?: string;
  sortBy: SortField;
  sortOrder: SortOrder;
};

export type PaginatedUsers = {
  data: PublicUser[];
  meta: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    limit: number;
    page: number;
    total: number;
    totalPages: number;
  };
};

export type AdminUserPatch = {
  email?: string;
  role?: Role;
};

const sortFieldMap: Record<
  SortField,
  keyof Prisma.UserOrderByWithRelationInput
> = {
  createdAt: 'createdAt',
  email: 'email',
  role: 'role',
  updatedAt: 'updatedAt',
};

const publicUserSelect = {
  createdAt: true,
  email: true,
  id: true,
  role: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    email: string;
    passwordHash: string;
    role: Role;
  }): Promise<PublicUser> {
    try {
      const user = await this.prisma.user.create({ data: input });
      return this.toPublicUser(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new PlatformError('USER_EMAIL_ALREADY_EXISTS');
      }
      throw error;
    }
  }

  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<Pick<User, 'id' | 'role'> | null> {
    return this.prisma.user.findUnique({
      select: { id: true, role: true },
      where: { id },
    });
  }

  async findPublicById(id: string): Promise<PublicUser | null> {
    return this.prisma.user.findUnique({
      select: {
        createdAt: true,
        email: true,
        id: true,
        role: true,
        updatedAt: true,
      },
      where: { id },
    });
  }

  findByIdWithPassword(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async list(params: ListUsersParams): Promise<PaginatedUsers> {
    const where: Prisma.UserWhereInput =
      params.search !== undefined && params.search.length > 0
        ? { email: { contains: params.search, mode: 'insensitive' } }
        : {};
    const orderBy = { [sortFieldMap[params.sortBy]]: params.sortOrder };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        orderBy,
        select: publicUserSelect,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        where,
      }),
      this.prisma.user.count({ where }),
    ]);
    const totalPages = Math.ceil(total / params.limit);

    return {
      data,
      meta: {
        hasNextPage: params.page < totalPages,
        hasPreviousPage: params.page > 1,
        limit: params.limit,
        page: params.page,
        total,
        totalPages,
      },
    };
  }

  async transact<T>(work: (users: UserTransaction) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        return work({
          countAdmins: () =>
            transaction.user.count({ where: { role: Role.ADMIN } }),
          findRole: async (id) => {
            const user = await transaction.user.findUnique({
              select: { role: true },
              where: { id },
            });
            return user?.role ?? null;
          },
          updateAdmin: async (id, patch) => {
            const updated = await transaction.user.update({
              data: {
                ...(patch.email !== undefined ? { email: patch.email } : {}),
                ...(patch.role !== undefined ? { role: patch.role } : {}),
              },
              where: { id },
            });
            return this.toPublicUser(updated);
          },
          updateEmail: async (id, email) => {
            const user = await transaction.user.update({
              data: { email },
              where: { id },
            });
            return this.toPublicUser(user);
          },
          updatePassword: async (id, passwordHash) => {
            await transaction.user.update({
              data: { passwordHash },
              where: { id },
            });
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new PlatformError('USER_EMAIL_ALREADY_EXISTS');
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new PlatformError('USER_NOT_FOUND');
      }
      throw error;
    }
  }

  private toPublicUser(user: User): PublicUser {
    return {
      createdAt: user.createdAt,
      email: user.email,
      id: user.id,
      role: user.role,
      updatedAt: user.updatedAt,
    };
  }
}
