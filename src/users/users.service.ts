import { Injectable } from '@nestjs/common';
import { Role, User } from '@prisma/client';
import {
  PublicUser,
  UsersRepository,
  UserTransaction,
} from './users.repository';

export type { PublicUser } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly users: UsersRepository) {}

  create(input: {
    email: string;
    passwordHash: string;
    role: Role;
  }): Promise<PublicUser> {
    return this.users.create(input);
  }

  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.users.findByEmailWithPassword(email);
  }

  findById(id: string): Promise<Pick<User, 'id' | 'role'> | null> {
    return this.users.findById(id);
  }

  findPublicById(id: string): Promise<PublicUser | null> {
    return this.users.findPublicById(id);
  }

  findByIdWithPassword(id: string): Promise<User | null> {
    return this.users.findByIdWithPassword(id);
  }

  transact<T>(work: (users: UserTransaction) => Promise<T>): Promise<T> {
    return this.users.transact(work);
  }
}
