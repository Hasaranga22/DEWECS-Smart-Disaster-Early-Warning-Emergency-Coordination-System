import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import type { OfficerRole } from '../src/generated/prisma/enums';
import { CITIZENS, DISTRICTS, OFFICERS, RIVER_BASINS } from '../src/shared/seed';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required to seed the database.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  console.log('Seeding shared dataset for UC1...');

  // 1. Districts (25)
  for (const d of DISTRICTS) {
    await prisma.district.upsert({
      where: { id: d.id },
      create: { id: d.id, name: d.name },
      update: { name: d.name },
    });
  }
  console.log(`✓ Upserted ${DISTRICTS.length} districts`);

  // 2. River Basins (7)
  for (const b of RIVER_BASINS) {
    await prisma.riverBasin.upsert({
      where: { id: b.id },
      create: { id: b.id, name: b.name, description: b.description },
      update: { name: b.name, description: b.description },
    });
  }
  console.log(`✓ Upserted ${RIVER_BASINS.length} river basins`);

  // 3. Basin-District mappings
  let basinDistrictsCount = 0;
  for (const b of RIVER_BASINS) {
    for (const districtId of b.districtIds ?? []) {
      await prisma.basinDistrict.upsert({
        where: {
          basinId_districtId: {
            basinId: b.id,
            districtId,
          },
        },
        create: { basinId: b.id, districtId },
        update: {},
      });
      basinDistrictsCount++;
    }
  }
  console.log(`✓ Upserted ${basinDistrictsCount} basin-district mappings`);

  // 4. Officers (27)
  for (const o of OFFICERS) {
    await prisma.officer.upsert({
      where: { id: o.id },
      create: {
        id: o.id,
        name: o.name,
        role: o.role as OfficerRole,
        districtId: o.districtId ?? null,
        phone: o.phone ?? null,
        email: o.email ?? null,
      },
      update: {
        name: o.name,
        role: o.role as OfficerRole,
        districtId: o.districtId ?? null,
        phone: o.phone ?? null,
        email: o.email ?? null,
      },
    });
  }
  console.log(`✓ Upserted ${OFFICERS.length} officers`);

  // 5. Citizens (49)
  for (const c of CITIZENS) {
    await prisma.citizen.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        name: c.name,
        nationalId: c.nationalId ?? null,
        phone: c.phone ?? null,
        pushToken: c.pushToken ?? null,
        districtId: c.districtId ?? null,
        isVolunteer: c.isVolunteer ?? false,
      },
      update: {
        name: c.name,
        nationalId: c.nationalId ?? null,
        phone: c.phone ?? null,
        pushToken: c.pushToken ?? null,
        districtId: c.districtId ?? null,
        isVolunteer: c.isVolunteer ?? false,
      },
    });
  }
  console.log(`✓ Upserted ${CITIZENS.length} citizens`);

  console.log('UC1 shared seed completed successfully.');
}

main()
  .catch((err) => {
    console.error('Failed to seed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
