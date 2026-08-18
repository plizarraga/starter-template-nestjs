import { randomBytes, scrypt } from 'node:crypto';

type AdminSeedClient = {
  user: {
    upsert(input: {
      create: { email: string; passwordHash: string; role: 'ADMIN' };
      update: { passwordHash: string; role: 'ADMIN' };
      where: { email: string };
    }): Promise<unknown>;
  };
};

export async function hashSeedPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password,
      salt,
      64,
      { N: 131072, maxmem: 268435456, p: 1, r: 8 },
      (error, key) => {
        if (error !== null) {
          reject(error);
          return;
        }
        resolve(key);
      },
    );
  });

  return `scrypt$131072$8$1$${salt.toString('base64')}$${derivedKey.toString('base64')}`;
}

export async function seedAdmin(
  client: AdminSeedClient,
  email: string,
  password: string,
  hashPassword: (value: string) => Promise<string> = hashSeedPassword,
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await hashPassword(password);

  await client.user.upsert({
    where: { email: normalizedEmail },
    update: { passwordHash, role: 'ADMIN' },
    create: { email: normalizedEmail, passwordHash, role: 'ADMIN' },
  });
}
