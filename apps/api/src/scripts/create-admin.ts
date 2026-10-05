import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { CONSENT_VERSIONS } from '@breastscan/shared';
import { randomBytes } from 'node:crypto';
import { hashPassword } from '../auth/password.js';
import { ConsentType, PrismaClient, Role } from '../generated/prisma/client.js';

/**
 * Creates an admin account, or promotes and resets an existing one, and prints
 * its login details once. Safe in production:
 *
 *   ADMIN_EMAIL=you@example.com node dist/scripts/create-admin.js
 *
 * Set ADMIN_PASSWORD to choose the password; otherwise a strong one is generated.
 */
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || generatePassword();
const CONSENTS = [ConsentType.TERMS, ConsentType.PRIVACY, ConsentType.HEALTH_DATA];

function generatePassword(): string {
  // base64url can lack a digit or a case, so add one of each to satisfy the password rule.
  return `${randomBytes(18).toString('base64url')}aA1`;
}

async function main() {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Set ADMIN_EMAIL to a valid email address');
  if (password.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters');

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const now = new Date();
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.upsert({
      where: { email },
      update: { role: Role.ADMIN, passwordHash, lockedUntil: null, failedLoginCount: 0, deletedAt: null },
      create: {
        email,
        passwordHash,
        role: Role.ADMIN,
        emailVerifiedAt: now,
        onboardingCompletedAt: now,
        profile: { create: { firstName: 'Admin', lastName: 'User' } },
        consents: { create: CONSENTS.map((type) => ({ type, granted: true, version: CONSENT_VERSIONS[type] })) },
      },
    });
    // Existing sessions were issued under the old password.
    await prisma.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now } });
    console.log(`Admin account ready.\n  Email:    ${user.email}\n  Password: ${password}\nSign in and change the password.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
