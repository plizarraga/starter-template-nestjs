import { hashPassword } from 'better-auth/crypto';
import { randomUUID } from 'node:crypto';

type SeedRole = 'ADMIN' | 'USER';

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
      update: { password: string };
      where: {
        providerId_accountId: { accountId: string; providerId: string };
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
        role: SeedRole;
      };
      update: { role: SeedRole };
      where: { email: string };
    }): Promise<{ id: string }>;
  };
};

export async function seedAdmin(
  client: AdminSeedClient,
  email: string,
  password: string,
  hash: (value: string) => Promise<string> = hashPassword,
  role: SeedRole = 'ADMIN',
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
      role,
    },
    update: { role },
    where: { email: normalizedEmail },
  });
  await client.account.upsert({
    create: {
      accountId: user.id,
      id: randomUUID(),
      password: passwordDigest,
      providerId: 'credential',
      userId: user.id,
    },
    update: { password: passwordDigest },
    where: {
      providerId_accountId: {
        accountId: user.id,
        providerId: 'credential',
      },
    },
  });
}
