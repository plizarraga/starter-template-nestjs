import { PrismaClient } from '@prisma/client';
import {
  defaultScryptParameters,
  hashSeedPassword,
  seedAdmin,
} from '../src/platform/prisma/admin-seed';

function readPositiveInteger(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (value === undefined) {
    return defaultValue;
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

async function main(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (
    email === undefined ||
    email.trim() === '' ||
    password === undefined ||
    password.trim() === ''
  ) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required');
  }

  const prisma = new PrismaClient();
  try {
    const parameters = {
      N: readPositiveInteger('SCRYPT_N', defaultScryptParameters.N),
      r: readPositiveInteger('SCRYPT_R', defaultScryptParameters.r),
      p: readPositiveInteger('SCRYPT_P', defaultScryptParameters.p),
      maxmem: readPositiveInteger(
        'SCRYPT_MAXMEM',
        defaultScryptParameters.maxmem,
      ),
    };
    await seedAdmin(prisma, email, password, (value) =>
      hashSeedPassword(value, parameters),
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main();
