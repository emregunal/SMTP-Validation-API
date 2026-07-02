import { PrismaClient } from '@prisma/client';
import { DISPOSABLE_DOMAINS } from '../src/common/constants/disposable-domains.const';
import { ROLE_BASED_PREFIXES } from '../src/common/constants/role-based-prefixes.const';

const prisma = new PrismaClient();

async function seedDisposableDomains(): Promise<void> {
  for (const domain of DISPOSABLE_DOMAINS) {
    await prisma.disposableDomain.upsert({
      where: { domain },
      update: {},
      create: { domain, source: 'seed', active: true },
    });
  }
  console.log(`✓ Seeded ${DISPOSABLE_DOMAINS.length} disposable domains`);
}

async function seedRoleBasedPrefixes(): Promise<void> {
  for (const prefix of ROLE_BASED_PREFIXES) {
    await prisma.roleBasedPrefix.upsert({
      where: { prefix },
      update: {},
      create: { prefix, active: true },
    });
  }
  console.log(`✓ Seeded ${ROLE_BASED_PREFIXES.length} role-based prefixes`);
}

async function main(): Promise<void> {
  console.log('Seeding database...');
  await seedDisposableDomains();
  await seedRoleBasedPrefixes();
  console.log('Seeding complete.');
}

main()
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
