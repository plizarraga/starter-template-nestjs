import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { seedAdmin } from './admin-seed';

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

  const adapter = new PrismaPg(
    { connectionString: process.env.DATABASE_URL ?? '' },
    { schema: process.env.DATABASE_SCHEMA || 'public' },
  );
  const prisma = new PrismaClient({ adapter });
  try {
    await seedAdmin(prisma, email, password);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
