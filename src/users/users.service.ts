import { Injectable } from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { PublicUser, UsersRepository } from './users.repository';

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
}
