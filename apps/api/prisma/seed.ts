import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import argon2 from 'argon2';
import { CONSENT_VERSIONS } from '@breastscan/shared';
import { ConsentType, PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Ready-to-use doctor account for local testing. Never seed this in production.
const TEST_EMAIL = process.env.SEED_TEST_EMAIL ?? 'test@breastscan.local';
const TEST_PASSWORD = process.env.SEED_TEST_PASSWORD ?? 'Test-Passw0rd!';
const CONSENTS = [ConsentType.TERMS, ConsentType.PRIVACY, ConsentType.HEALTH_DATA];

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed a test account in production');

  const now = new Date();
  const user = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: {
      passwordHash: await argon2.hash(TEST_PASSWORD, { type: argon2.argon2id }),
      lockedUntil: null,
      failedLoginCount: 0,
      deletedAt: null,
      profile: { upsert: { create: { firstName: 'Test', lastName: 'Doctor' }, update: { firstName: 'Test', lastName: 'Doctor' } } },
    },
    create: {
      email: TEST_EMAIL,
      passwordHash: await argon2.hash(TEST_PASSWORD, { type: argon2.argon2id }),
      emailVerifiedAt: now,
      onboardingCompletedAt: now,
      profile: { create: { firstName: 'Test', lastName: 'Doctor' } },
      consents: { create: CONSENTS.map((type) => ({ type, granted: true, version: CONSENT_VERSIONS[type] })) },
    },
  });
  console.log(`Test doctor account: ${user.email} / ${TEST_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
