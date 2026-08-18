import * as argon2 from 'argon2';
import {
  toArgon2Options,
  type Argon2Parameters,
} from '../security/argon2-options';

export type { Argon2Parameters } from '../security/argon2-options';

type AdminSeedClient = {
  user: {
    create(input: {
      data: { email: string; passwordHash: string; role: 'ADMIN' };
    }): Promise<unknown>;
    findUnique(input: {
      where: { email: string };
    }): Promise<{ role: 'USER' | 'ADMIN' } | null>;
    update(input: {
      data: { role: 'ADMIN' };
      where: { email: string };
    }): Promise<unknown>;
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
  const user = await client.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (user?.role === 'ADMIN') {
    return;
  }

  if (user !== null) {
    await client.user.update({
      where: { email: normalizedEmail },
      data: { role: 'ADMIN' },
    });
    return;
  }

  const passwordHash = await hashPassword(password);
  await client.user.create({
    data: { email: normalizedEmail, passwordHash, role: 'ADMIN' },
  });
}
