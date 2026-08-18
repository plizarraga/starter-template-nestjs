import { describe, expect, it } from 'vitest';
import { PasswordService } from './password.service';

const config = {
  getOrThrow: (key: string) => {
    const values: Record<string, number> = {
      ARGON2_MEMORY_COST: 8,
      ARGON2_PARALLELISM: 1,
      ARGON2_TIME_COST: 1,
    };
    return values[key];
  },
} as never;

describe('PasswordService', () => {
  it('When a password is hashed, then it produces a self-describing argon2id PHC string', async () => {
    const passwords = new PasswordService(config);

    const hash = await passwords.hash('correct horse battery staple');

    expect(hash).toMatch(/^\$argon2id\$/);
  });

  it('When the correct password is verified against its own hash, then it matches', async () => {
    const passwords = new PasswordService(config);
    const hash = await passwords.hash('correct horse battery staple');

    await expect(
      passwords.verify('correct horse battery staple', hash),
    ).resolves.toBe(true);
  });

  it('When an incorrect password is verified against a hash, then it does not match', async () => {
    const passwords = new PasswordService(config);
    const hash = await passwords.hash('correct horse battery staple');

    await expect(passwords.verify('wrong password', hash)).resolves.toBe(false);
  });

  it('When verify is given a malformed or foreign digest, then it fails closed as no match instead of throwing', async () => {
    const passwords = new PasswordService(config);

    await expect(passwords.verify('anything', 'not-a-real-hash')).resolves.toBe(
      false,
    );
    await expect(
      passwords.verify(
        'anything',
        'scrypt$131072$8$1$268435456$deadbeef$deadbeef',
      ),
    ).resolves.toBe(false);
  });

  it('When consuming verification cost for a non-existent user, then it resolves without throwing', async () => {
    const passwords = new PasswordService(config);

    await expect(
      passwords.consumeVerificationCost('some password'),
    ).resolves.toBeUndefined();
  });
});
