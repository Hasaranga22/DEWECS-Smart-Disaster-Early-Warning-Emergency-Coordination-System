import 'dotenv/config'
import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

async function main() {
  console.log('')
  console.log('  UC4  Sample Data Seeding')
  console.log('\n')

  //  STEP 0: Defensive cleanup 
  console.log(' STEP 0: Cleaning previous sample data...')
  await prisma.distribution.deleteMany({
    where: { actionId: { startsWith: 'sample-action-' } },
  }).catch(() => {})
  await prisma.supplyStock.deleteMany({
    where: { supplyType: { in: ['FOOD', 'WATER', 'MEDICINE'] } },
  }).catch(() => {})
  await prisma.reportAuditEntry.deleteMany({
    where: { district: { name: 'Kegalle' }, officer: { name: { startsWith: 'Sample ' } } },
  }).catch(() => {})
  await prisma.groundReport.deleteMany({
    where: { localId: { startsWith: 'sample-report-' } },
  }).catch(() => {})
  await prisma.notificationAttempt.deleteMany({
    where: { district: { name: 'Kegalle' } },
  }).catch(() => {})
  await prisma.hazardAlert.deleteMany({
    where: { message: { contains: 'Sample' } },
  }).catch(() => {})
  await prisma.officer.deleteMany({
    where: { name: { startsWith: 'Sample ' } },
  }).catch(() => {})
  await prisma.shelter.deleteMany({
    where: { name: { startsWith: 'Sample Shelter' } },
  }).catch(() => {})
  await prisma.citizen.deleteMany({
    where: { name: { startsWith: 'Sample Citizen' } },
  }).catch(() => {})
  console.log('   Cleanup done\n')

  //  STEP 1: Districts 
  console.log(' STEP 1: Seeding districts...')
  const kegalle = await prisma.district.upsert({
    where: { name: 'Kegalle' },
    update: {},
    create: { name: 'Kegalle' },
  })
  const gampaha = await prisma.district.upsert({
    where: { name: 'Gampaha' },
    update: {},
    create: { name: 'Gampaha' },
  })
  console.log(`   Districts ready (Kegalle: ${kegalle.id})\n`)

  //  STEP 2: Officers 
  console.log(' STEP 2: Seeding officers...')
  const dmcOfficial = await prisma.officer.create({
    data: {
      name: 'Sample DMC Official',
      role: 'DMC_OFFICIAL',
      phone: '0770000001',
      email: 'dmc@dewecs.lk',
    },
  })
  const dutyOfficer = await prisma.officer.create({
    data: {
      name: 'Sample Duty Officer',
      role: 'DUTY_OFFICER',
      districtId: kegalle.id,
      phone: '0770000002',
    },
  })
  const districtOfficer = await prisma.officer.create({
    data: {
      name: 'Sample District Officer',
      role: 'DISTRICT_OFFICER',
      districtId: kegalle.id,
      phone: '0770000003',
    },
  })
  console.log(`   Officers ready`)
  console.log(`     DMC Official:     ${dmcOfficial.id}`)
  console.log(`     Duty Officer:     ${dutyOfficer.id}`)
  console.log(`     District Officer: ${districtOfficer.id}\n`)

  //  STEP 3: Organizations 
  console.log(' STEP 3: Seeding organizations...')
  const ngo = await prisma.organization.upsert({
    where: { name: 'Sample World Vision Lanka' },
    update: {},
    create: {
      name: 'Sample World Vision Lanka',
      type: 'NGO',
      coordinatorName: 'NGO Coordinator',
      coordinatorEmail: 'ngo@example.lk',
    },
  })
  const army = await prisma.organization.upsert({
    where: { name: 'Sample Sri Lanka Army' },
    update: {},
    create: {
      name: 'Sample Sri Lanka Army',
      type: 'ARMED_FORCES',
      coordinatorName: 'Army Coordinator',
    },
  })
  const donor = await prisma.organization.upsert({
    where: { name: 'Sample Private Donor' },
    update: {},
    create: { name: 'Sample Private Donor', type: 'PRIVATE_DONOR' },
  })
  console.log(`   Organizations ready`)
  console.log(`     NGO:   ${ngo.id}`)
  console.log(`     Army:  ${army.id}`)
  console.log(`     Donor: ${donor.id}\n`)

  //  STEP 4: Hazard Alerts 
  console.log(' STEP 4: Seeding hazard alerts...')
  const alert1 = await prisma.hazardAlert.create({
    data: {
      hazardType: 'FLOOD',
      severity: 'WARNING',
      status: 'ACTIVE',
      message: 'Sample Flood warning for Kegalle district',
      issuedById: dmcOfficial.id,
      occurredAt: new Date('2026-08-15T10:00:00Z'),
      expiresAt: new Date('2026-08-20T10:00:00Z'),
    },
  })
  const alert2 = await prisma.hazardAlert.create({
    data: {
      hazardType: 'LANDSLIDE',
      severity: 'WATCH',
      status: 'ESCALATED',
      message: 'Sample Landslide watch for Kegalle',
      issuedById: dmcOfficial.id,
      occurredAt: new Date('2026-08-20T14:00:00Z'),
    },
  })
  console.log(`   Alerts ready (Flood: ${alert1.id})\n`)

  //  STEP 5: Notification Attempts 
  console.log(' STEP 5: Seeding 2000 notification attempts...')
  console.log('   Distribution: 850 both delivered, 100 push-only, 50 sms-only\n')

  // Seed sample citizens with valid UUIDs
  const citizenData = []
  for (let i = 1; i <= 1000; i++) {
    const id = `00000000-0000-4000-a000-${i.toString().padStart(12, '0')}`
    citizenData.push({
      id,
      name: `Sample Citizen ${i}`,
      isVolunteer: false,
      districtId: kegalle.id,
    })
  }
  await prisma.citizen.createMany({
    data: citizenData,
    skipDuplicates: true,
  })

  const attempts: any[] = []
  const baseTime = new Date('2026-08-15T10:05:00Z')

  for (let i = 1; i <= 1000; i++) {
    const citizenId = `00000000-0000-4000-a000-${i.toString().padStart(12, '0')}`

    // SMS: delivered for first 850 + last 50 (total 900 delivered)
    const smsDelivered = i <= 850 || i > 950
    attempts.push({
      alertId: alert1.id,
      citizenId,
      districtId: kegalle.id,
      hazardType: 'FLOOD',
      channel: 'SMS',
      status: smsDelivered ? 'DELIVERED' : 'FAILED',
      kind: 'ISSUE',
      occurredAt: baseTime,
      sentAt: baseTime,
      deliveredAt: smsDelivered ? baseTime : null,
    })

    // PUSH: delivered for first 950 (total 950 delivered)
    const pushDelivered = i <= 950
    attempts.push({
      alertId: alert1.id,
      citizenId,
      districtId: kegalle.id,
      hazardType: 'FLOOD',
      channel: 'PUSH',
      status: pushDelivered ? 'DELIVERED' : 'FAILED',
      kind: 'ISSUE',
      occurredAt: baseTime,
      sentAt: baseTime,
      deliveredAt: pushDelivered ? baseTime : null,
    })
  }

  // Chunked insert
  for (let i = 0; i < attempts.length; i += 500) {
    await prisma.notificationAttempt.createMany({
      data: attempts.slice(i, i + 500),
    })
  }
  console.log(`   2000 attempts created`)
  console.log(`     distinctCitizens = 1000`)
  console.log(`     PUSH: 1000 attempted, 950 delivered, 50 failed`)
  console.log(`     SMS:  1000 attempted, 900 delivered, 100 failed\n`)

  //  STEP 6: Ground Reports 
  console.log(' STEP 6: Seeding ground reports...')
  for (let i = 1; i <= 51; i++) {
    const localId = `sample-report-${i.toString().padStart(3, '0')}`
    const day = ((i % 28) + 1).toString().padStart(2, '0')
    const captureTime = new Date(`2026-08-${day}T10:00:00Z`)
    const reporterCitizenId = `00000000-0000-4000-a000-${((i % 20) + 1).toString().padStart(12, '0')}`

    let reviewStatus: 'VERIFIED' | 'REJECTED' | 'PENDING_REVIEW' | 'NEEDS_INFO'
    if (i <= 42) reviewStatus = 'VERIFIED'
    else if (i <= 45) reviewStatus = 'REJECTED'
    else if (i <= 48) reviewStatus = 'PENDING_REVIEW'
    else reviewStatus = 'NEEDS_INFO'

    const report = await prisma.groundReport.create({
      data: {
        localId,
        reporterId: reporterCitizenId,
        districtId: kegalle.id,
        hazardType: i % 3 === 0 ? 'LANDSLIDE' : 'FLOOD',
        description: `Sample report #${i} - observed hazard`,
        latitude: 7.25 + i * 0.001,
        longitude: 80.35 + i * 0.001,
        locationSource: 'GPS',
        gpsAccuracyM: 15.5,
        confidence: i % 5 === 0 ? 'REDUCED' : 'FULL',
        reviewStatus,
        severityIndication: reviewStatus === 'VERIFIED' ? 'HIGH' : null,
        captureTime,
        syncTime: captureTime,
        version: 1,
      },
    })

    if (reviewStatus === 'VERIFIED' || reviewStatus === 'REJECTED') {
      await prisma.reportAuditEntry.create({
        data: {
          reportId: report.id,
          action: reviewStatus,
          officerId: dutyOfficer.id,
          reason: reviewStatus === 'REJECTED' ? 'Insufficient evidence' : null,
          occurredAt: new Date(captureTime.getTime() + 3600_000),
          districtId: kegalle.id,
          hazardType: report.hazardType,
        },
      })
    }
  }
  console.log(`   51 ground reports + 45 audit entries created\n`)

  //  STEP 7: Supply Stocks 
  console.log(' STEP 7: Seeding supply stocks...')
  const foodStock = await prisma.supplyStock.create({
    data: {
      organizationId: ngo.id,
      districtId: kegalle.id,
      supplyType: 'FOOD',
      onHand: 10000,
    },
  })
  const waterStock = await prisma.supplyStock.create({
    data: {
      organizationId: ngo.id,
      districtId: kegalle.id,
      supplyType: 'WATER',
      onHand: 5500,
    },
  })
  const medStock = await prisma.supplyStock.create({
    data: {
      organizationId: ngo.id,
      districtId: kegalle.id,
      supplyType: 'MEDICINE',
      onHand: 800,
    },
  })
  console.log(`   3 supply stocks created\n`)

  //  STEP 8: Distributions 
  console.log(' STEP 8: Seeding distributions...')
  const shelter1Id = '00000000-0000-4000-c000-000000000001'
  const shelter2Id = '00000000-0000-4000-c000-000000000002'

  await prisma.shelter.upsert({
    where: { id: shelter1Id },
    update: {},
    create: {
      id: shelter1Id,
      name: 'Sample Shelter 1',
      address: 'Sample Address 1',
      capacity: 500,
      occupancy: 0,
      status: 'OPEN',
      version: 1,
      districtId: kegalle.id,
      organizationId: ngo.id,
    },
  })
  await prisma.shelter.upsert({
    where: { id: shelter2Id },
    update: {},
    create: {
      id: shelter2Id,
      name: 'Sample Shelter 2',
      address: 'Sample Address 2',
      capacity: 500,
      occupancy: 0,
      status: 'OPEN',
      version: 1,
      districtId: kegalle.id,
      organizationId: ngo.id,
    },
  })

  await prisma.distribution.create({
    data: {
      stockId: foodStock.id,
      destinationShelterId: shelter1Id,
      organizationId: ngo.id,
      districtId: kegalle.id,
      quantity: 3000,
      actorId: districtOfficer.id,
      occurredAt: new Date('2026-08-16T10:00:00Z'),
      actionId: 'sample-action-food-1',
    },
  })
  await prisma.distribution.create({
    data: {
      stockId: foodStock.id,
      destinationShelterId: shelter2Id,
      organizationId: ngo.id,
      districtId: kegalle.id,
      quantity: 2000,
      actorId: districtOfficer.id,
      occurredAt: new Date('2026-08-17T10:00:00Z'),
      actionId: 'sample-action-food-2',
    },
  })
  await prisma.distribution.create({
    data: {
      stockId: waterStock.id,
      destinationShelterId: shelter1Id,
      organizationId: ngo.id,
      districtId: kegalle.id,
      quantity: 5500,
      actorId: districtOfficer.id,
      occurredAt: new Date('2026-08-16T11:00:00Z'),
      actionId: 'sample-action-water-1',
    },
  })
  await prisma.distribution.create({
    data: {
      stockId: medStock.id,
      destinationShelterId: shelter2Id,
      organizationId: ngo.id,
      districtId: kegalle.id,
      quantity: 640,
      actorId: districtOfficer.id,
      occurredAt: new Date('2026-08-17T11:00:00Z'),
      actionId: 'sample-action-med-1',
    },
  })
  console.log(`   4 distributions created`)
  console.log(`     Expected: FOOD=50%, WATER=100%, MEDICINE=80%\n`)

  //  FINAL SUMMARY 
  console.log('')
  console.log('   SEEDING COMPLETE')
  console.log('\n')
  console.log(' Summary:')
  console.log('  Districts:             2')
  console.log('  Officers:              3')
  console.log('  Organizations:         3')
  console.log('  Hazard Alerts:         2')
  console.log('  Notification Attempts: 2000')
  console.log('  Ground Reports:        51')
  console.log('  Report Audit Entries:  45')
  console.log('  Supply Stocks:         3')
  console.log('  Distributions:         4')
  console.log('\n Key IDs (save these for API testing):')
  console.log(`  DMC Official ID:   ${dmcOfficial.id}`)
  console.log(`  Duty Officer ID:   ${dutyOfficer.id}`)
  console.log(`  District Officer:  ${districtOfficer.id}`)
  console.log(`  Kegalle District:  ${kegalle.id}`)
  console.log(`  NGO Org ID:        ${ngo.id}`)
  console.log(`  Army Org ID:       ${army.id}`)
  console.log(`  Donor Org ID:      ${donor.id}`)
  console.log(`  Flood Alert ID:    ${alert1.id}`)
  console.log('\n Next: Open Prisma Studio and verify:')
  console.log('   http://localhost:51212')
  console.log('')

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(' Seed failed:', err)
  process.exit(1)
})
