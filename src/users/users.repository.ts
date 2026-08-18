import { Injectable } from '@nestjs/common';
import { Prisma, Role, User } from '@prisma/client';
import { PlatformError } from '../platform/errors/platform-error';
import { PrismaService } from '../platform/prisma/prisma.service';

export type PublicUser = Omit<User, 'passwordHash'>;

export type UserTransaction = {
  updateEmail(id: string, email: string): Promise<PublicUser>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
};

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

  async transact<T>(work: (users: UserTransaction) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        return work({
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
