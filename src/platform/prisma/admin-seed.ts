import { hashPassword } from 'better-auth/crypto';
import { randomUUID } from 'node:crypto';

type AdminSeedClient = {
  account: {
    upsert(input: {
      create: {
        accountId: string;
        id: string;
        issuer: 'local:credential';
        password: string;
        providerId: 'credential';
        userId: string;
      };
      update: { password: string };
      where: {
        issuer_accountId: { accountId: string; issuer: string };
      };
    }): Promise<unknown>;
  };
  user: {
    upsert(input: {
      create: {
        email: string;
        emailVerified: false;
        id: string;
        name: string;
        role: 'ADMIN';
      };
      update: { role: 'ADMIN' };
      where: { email: string };
    }): Promise<{ id: string }>;
  };
};

export async function seedAdmin(
  client: AdminSeedClient,
  email: string,
  password: string,
  hash: (value: string) => Promise<string> = hashPassword,
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const passwordDigest = await hash(password);
  const userId = randomUUID();
  const user = await client.user.upsert({
    create: {
      email: normalizedEmail,
      emailVerified: false,
      id: userId,
      name: normalizedEmail,
      role: 'ADMIN',
    },
    update: { role: 'ADMIN' },
    where: { email: normalizedEmail },
  });
  await client.account.upsert({
    create: {
      accountId: user.id,
      id: randomUUID(),
      issuer: 'local:credential',
      password: passwordDigest,
      providerId: 'credential',
      userId: user.id,
    },
    update: { password: passwordDigest },
    where: {
      issuer_accountId: {
        accountId: user.id,
        issuer: 'local:credential',
      },
    },
  });
}
