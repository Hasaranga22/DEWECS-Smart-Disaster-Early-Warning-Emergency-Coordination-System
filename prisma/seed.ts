import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { buildUc3Seed } from '../src/modules/uc3-resources/seed/buildUc3Seed';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required to seed the database.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  console.log('Seeding database with required foreign key records for UC2 testing...');

  // 1. Seed a District
  const districtId = '550e8400-e29b-41d4-a716-446655440000';
  await prisma.district.upsert({
    where: { id: districtId },
    update: {},
    create: {
      id: districtId,
      name: 'Colombo District',
    },
  });

  // 2. Seed a Citizen
  const citizenId = '550e8400-e29b-41d4-a716-446655440001';
  await prisma.citizen.upsert({
    where: { id: citizenId },
    update: {},
    create: {
      id: citizenId,
      name: 'Hasaranga (Test User)',
      isVolunteer: false,
    },
  });

  // 3. Seed an Officer
  const officerId = '550e8400-e29b-41d4-a716-446655440002';
  await prisma.officer.upsert({
    where: { id: officerId },
    update: {},
    create: {
      id: officerId,
      name: 'Test Duty Officer',
      role: 'DISTRICT_OFFICER', // Assume this is a valid enum value
      districtId: districtId,
    },
  });

  // [UC3 SEED REGISTRATION HOOK - Sandaruwan]
  const uc3Seed = buildUc3Seed({
    districtsByName: { Colombo: districtId },
    organizationsByName: {},
  });
  console.log(`UC3 seed ready: ${uc3Seed.shelters.length} shelters, ${uc3Seed.teams.length} teams.`);

  console.log('✅ Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
