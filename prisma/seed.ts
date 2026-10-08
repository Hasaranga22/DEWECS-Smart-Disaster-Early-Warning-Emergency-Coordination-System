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
  console.log('Seeding database with required foreign key records for UC2 & UC3 testing...');

  // 1. Seed Districts
  const districtId = '550e8400-e29b-41d4-a716-446655440000';
  const colomboId = '00000000-0000-4000-8000-000000000010';
  const gampahaId = '00000000-0000-4000-8000-000000000020';

  await prisma.district.upsert({
    where: { id: districtId },
    update: {},
    create: { id: districtId, name: 'Colombo District (Legacy)' },
  });

  await prisma.district.upsert({
    where: { id: colomboId },
    update: {},
    create: { id: colomboId, name: 'Colombo' },
  });

  await prisma.district.upsert({
    where: { id: gampahaId },
    update: {},
    create: { id: gampahaId, name: 'Gampaha' },
  });

  // 2. Seed Organizations
  const govOrgId = '00000000-0000-4000-8000-000000000100';
  const ngoOrgId = '00000000-0000-4000-8000-000000000200';
  const milOrgId = '00000000-0000-4000-8000-000000000300';
  const privOrgId = '00000000-0000-4000-8000-000000000400';

  await prisma.organization.upsert({
    where: { id: govOrgId },
    update: {},
    create: { id: govOrgId, name: 'Disaster Management Centre (Gov)', type: 'GOVERNMENT' },
  });

  await prisma.organization.upsert({
    where: { id: ngoOrgId },
    update: {},
    create: { id: ngoOrgId, name: 'Sri Lanka Red Cross Society', type: 'NGO' },
  });

  await prisma.organization.upsert({
    where: { id: milOrgId },
    update: {},
    create: { id: milOrgId, name: 'Sri Lanka Armed Forces', type: 'ARMED_FORCES' },
  });

  await prisma.organization.upsert({
    where: { id: privOrgId },
    update: {},
    create: { id: privOrgId, name: 'Private Relief Donors Alliance', type: 'PRIVATE_DONOR' },
  });

  // 3. Seed Citizen
  const citizenId = '550e8400-e29b-41d4-a716-446655440001';
  await prisma.citizen.upsert({
    where: { id: citizenId },
    update: {},
    create: {
      id: citizenId,
      name: 'Hasaranga (Test User)',
      isVolunteer: false,
      districtId: colomboId,
    },
  });

  // 4. Seed Officer
  const officerId = '550e8400-e29b-41d4-a716-446655440002';
  const defaultOfficerId = '00000000-0000-4000-8000-000000000999';

  await prisma.officer.upsert({
    where: { id: officerId },
    update: {},
    create: {
      id: officerId,
      name: 'Test Duty Officer',
      role: 'DISTRICT_OFFICER',
      districtId: districtId,
    },
  });

  await prisma.officer.upsert({
    where: { id: defaultOfficerId },
    update: {},
    create: {
      id: defaultOfficerId,
      name: 'Colombo District Duty Officer',
      role: 'DISTRICT_OFFICER',
      districtId: colomboId,
    },
  });

  // 5. Build & Persist UC3 Seed Entities
  const uc3Seed = buildUc3Seed({
    districtsByName: { Colombo: colomboId, Gampaha: gampahaId },
    organizationsByName: {
      Government: govOrgId,
      RedCross: ngoOrgId,
      ArmedForces: milOrgId,
      PrivateDonor: privOrgId,
    },
  });

  for (const s of uc3Seed.shelters) {
    await prisma.shelter.upsert({
      where: { id: s.id },
      update: {},
      create: {
        id: s.id,
        districtId: s.districtId,
        organizationId: s.organizationId,
        name: s.name,
        address: s.address,
        capacity: s.capacity,
        occupancy: s.occupancy,
        status: s.status,
        version: s.version,
      },
    });
  }

  for (const t of uc3Seed.teams) {
    await prisma.rescueTeam.upsert({
      where: { id: t.id },
      update: {},
      create: {
        id: t.id,
        districtId: t.districtId,
        organizationId: t.organizationId,
        name: t.name,
        capability: t.capability,
        status: t.status,
        version: t.version,
      },
    });
  }

  for (const st of uc3Seed.stocks) {
    await prisma.supplyStock.upsert({
      where: { id: st.id },
      update: {},
      create: {
        id: st.id,
        organizationId: st.organizationId,
        districtId: st.districtId,
        supplyType: st.supplyType,
        onHand: st.onHand,
        version: st.version,
      },
    });
  }

  console.log(`UC3 seed complete: ${uc3Seed.shelters.length} shelters, ${uc3Seed.teams.length} teams, ${uc3Seed.stocks.length} stocks persisted.`);
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
