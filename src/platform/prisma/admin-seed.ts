import { randomBytes, scrypt } from 'node:crypto';

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

export type ScryptParameters = {
  maxmem: number;
  N: number;
  p: number;
  r: number;
};

export const defaultScryptParameters: ScryptParameters = {
  maxmem: 268435456,
  N: 131072,
  p: 1,
  r: 8,
};

export async function hashSeedPassword(
  password: string,
  parameters: ScryptParameters = defaultScryptParameters,
): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, parameters, (error, key) => {
      if (error !== null) {
        reject(error);
        return;
      }
      resolve(key);
    });
  });

  return `scrypt$${parameters.N}$${parameters.r}$${parameters.p}$${salt.toString('base64')}$${derivedKey.toString('base64')}`;
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
