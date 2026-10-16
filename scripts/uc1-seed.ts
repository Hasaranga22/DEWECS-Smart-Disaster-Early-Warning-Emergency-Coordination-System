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
    const existingByName = await prisma.district.findUnique({
      where: { name: d.name },
    });

    if (existingByName) {
      if (existingByName.id !== d.id) {
        // Cascade update the PK from previous/legacy ID to deterministic seed ID
        await prisma.$executeRaw`
          UPDATE district SET id = ${d.id}::uuid WHERE id = ${existingByName.id}::uuid
        `;
      }
    } else {
      const existingById = await prisma.district.findUnique({
        where: { id: d.id },
      });
      if (existingById) {
        await prisma.district.update({
          where: { id: d.id },
          data: { name: d.name },
        });
      } else {
        await prisma.district.create({
          data: { id: d.id, name: d.name },
        });
      }
    }
  }
  console.log(`✓ Handled ${DISTRICTS.length} districts`);

  // 2. River Basins (7)
  for (const b of RIVER_BASINS) {
    const existingBasin = await prisma.riverBasin.findFirst({
      where: {
        OR: [
          { name: b.name },
          { name: `${b.name} Basin` },
          { name: `${b.name} Ganga Basin` },
          { name: `${b.name} River Basin` },
        ],
      },
    });

    if (existingBasin) {
      if (existingBasin.id !== b.id) {
        await prisma.$executeRaw`
          UPDATE river_basin 
          SET id = ${b.id}::uuid, name = ${b.name}, description = ${b.description} 
          WHERE id = ${existingBasin.id}::uuid
        `;
      } else {
        await prisma.riverBasin.update({
          where: { id: b.id },
          data: { name: b.name, description: b.description },
        });
      }
    } else {
      await prisma.riverBasin.upsert({
        where: { id: b.id },
        create: { id: b.id, name: b.name, description: b.description },
        update: { name: b.name, description: b.description },
      });
    }
  }
  console.log(`✓ Handled ${RIVER_BASINS.length} river basins`);

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
  console.log(`✓ Handled ${basinDistrictsCount} basin-district mappings`);

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
  console.log(`✓ Handled ${OFFICERS.length} officers`);

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
  console.log(`✓ Handled ${CITIZENS.length} citizens`);

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
