import 'dotenv/config'
import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

async function main() {
  console.log('Connecting to database...')

  // 1. Connection test
  await prisma.$connect()
  console.log('✅ Connected!')

  // 2. Create test officer (required FK for AnalysisReport)
  const testActorId = crypto.randomUUID()
  const officer = await prisma.officer.create({
    data: {
      id: testActorId,
      name: 'Test Officer',
      role: 'DMC_OFFICIAL',
    },
  })
  console.log(`✅ Created test officer: ${officer.id}`)

  // 3. Count existing rows
  const beforeCount = await prisma.analysisReport.count()
  console.log(`📊 AnalysisReport rows BEFORE: ${beforeCount}`)

  // 4. Insert a test report
  const testReport = await prisma.analysisReport.create({
    data: {
      filters: {
        from: '2026-08-01T00:00:00Z',
        to: '2026-08-31T00:00:00Z',
        includedSections: ['ALERTS'],
        language: 'EN',
      },
      sourceCutoff: new Date(),
      generatedAt: new Date(),
      metrics: { test: true } as any,
      warningFlag: false,
      generatedBy: testActorId,
    },
  })
  console.log(`✅ INSERTED report with id: ${testReport.id}`)

  // 5. Count after
  const afterCount = await prisma.analysisReport.count()
  console.log(`📊 AnalysisReport rows AFTER: ${afterCount}`)

  // 6. Read it back
  const fetched = await prisma.analysisReport.findUnique({
    where: { id: testReport.id },
  })
  console.log(`📊 Fetched back:`, fetched?.id === testReport.id ? '✅ MATCH' : '❌ MISMATCH')

  // 7. Create test organization (required FK for ReportShare)
  const orgId = crypto.randomUUID()
  const org = await prisma.organization.create({
    data: {
      id: orgId,
      name: 'Test Organization',
      type: 'NGO',
    },
  })
  console.log(`✅ Created test organization: ${org.id}`)

  // 8. Insert a share row
  const share = await prisma.reportShare.create({
    data: {
      reportId: testReport.id,
      organizationId: orgId,
      status: 'SENT',
      attemptedAt: new Date(),
      actorId: testActorId,
    },
  })
  console.log(`✅ INSERTED share with id: ${share.id}`)

  // Cleanup (optional — comment out to keep data)
  await prisma.reportShare.deleteMany({ where: { reportId: testReport.id } })
  await prisma.analysisReport.delete({ where: { id: testReport.id } })
  await prisma.organization.delete({ where: { id: orgId } })
  await prisma.officer.delete({ where: { id: testActorId } })
  console.log('🧹 Cleaned up test data')

  await prisma.$disconnect()
  console.log('\n✅ ALL DB TESTS PASSED')
}

main()
  .catch((err) => {
    console.error('❌ DB TEST FAILED:', err)
    process.exit(1)
  })
