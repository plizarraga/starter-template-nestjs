import { PrismaClient } from '@prisma/client';
import { hashSeedPassword, seedAdmin } from '../src/platform/prisma/admin-seed';

async function main(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (email === undefined || email.trim() === '' || password === undefined) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required');
  }

  const prisma = new PrismaClient();
  try {
    await seedAdmin(prisma, email, password, hashSeedPassword);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
