import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import {
  toArgon2Options,
  type Argon2Parameters,
} from '../security/argon2-options';

export type { Argon2Parameters } from '../security/argon2-options';

type AdminSeedClient = {
  account: {
    upsert(input: {
      create: {
        accountId: string;
        id: string;
        password: string;
        providerId: 'credential';
        userId: string;
      };
      update: Record<string, never>;
      where: {
        providerId_accountId: { accountId: string; providerId: string };
      };
    }): Promise<unknown>;
  };
  user: {
    upsert(input: {
      create: {
        accounts: {
          create: {
            accountId: string;
            id: string;
            password: string;
            providerId: 'credential';
          };
        };
        email: string;
        emailVerified: false;
        id: string;
        name: string;
        passwordHash: string;
        role: 'ADMIN';
      };
      update: { role: 'ADMIN' };
      where: { email: string };
    }): Promise<{ id: string }>;
  };
};

export const defaultArgon2Parameters: Argon2Parameters = {
  memoryCost: 65536,
  parallelism: 4,
  timeCost: 3,
};

export async function hashSeedPassword(
  password: string,
  parameters: Argon2Parameters = defaultArgon2Parameters,
): Promise<string> {
  return argon2.hash(password, toArgon2Options(parameters));
}

export async function seedAdmin(
  client: AdminSeedClient,
  email: string,
  password: string,
  hashPassword: (value: string) => Promise<string> = hashSeedPassword,
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await hashPassword(password);
  const userId = randomUUID();
  const user = await client.user.upsert({
    create: {
      accounts: {
        create: {
          accountId: userId,
          id: randomUUID(),
          password: passwordHash,
          providerId: 'credential',
        },
      },
      email: normalizedEmail,
      emailVerified: false,
      id: userId,
      name: normalizedEmail,
      passwordHash,
      role: 'ADMIN',
    },
    update: { role: 'ADMIN' },
    where: { email: normalizedEmail },
  });
  await client.account.upsert({
    create: {
      accountId: user.id,
      id: randomUUID(),
      password: passwordHash,
      providerId: 'credential',
      userId: user.id,
    },
    update: {},
    where: {
      providerId_accountId: {
        accountId: user.id,
        providerId: 'credential',
      },
    },
  });
}
