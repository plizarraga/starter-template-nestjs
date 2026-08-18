import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import {
  defaultArgon2Parameters,
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

  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL ?? '',
  });
  const prisma = new PrismaClient({ adapter });
  try {
    const parameters = {
      memoryCost: readPositiveInteger(
        'ARGON2_MEMORY_COST',
        defaultArgon2Parameters.memoryCost,
      ),
      parallelism: readPositiveInteger(
        'ARGON2_PARALLELISM',
        defaultArgon2Parameters.parallelism,
      ),
      timeCost: readPositiveInteger(
        'ARGON2_TIME_COST',
        defaultArgon2Parameters.timeCost,
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
