/**
 * Shared fixtures for the UC4 full end-to-end DB integration suite.
 *
 * Used by BOTH entry points:
 *   - tests/integration/uc4-db-full.test.ts (vitest → npm run test:uc4:db)
 *   - scripts/uc4-full-db-test.ts           (tsx    → npm run test:uc4:db:script)
 *
 * Everything here talks to the REAL PostgreSQL database through Prisma —
 * no in-memory fakes for source data. Injected fakes are limited to the ports
 * UC4 declares (Clock, IdGenerator, AuditLogger, PartnerChannel,
 * OrganizationReader) so behaviour stays deterministic.
 */
import 'dotenv/config'
import { inflateSync } from 'node:zlib'

import type {
  AlertReader,
  AttemptReader,
  Distribution,
  DistributionReader,
  Filter,
  HazardAlert,
  HazardType,
  NotificationAttempt,
  OccupancyEvent,
  OccupancyEventReader,
  ReportDecision,
  ReportDecisionReader,
  SupplyStock,
  SupplyStockReader,
} from '@/shared/contracts/types'
import type { Actor, Clock, IdGenerator } from '@/shared/contracts/types'
import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/shared/infra/prisma/client'

import type { AuditLogger } from '@/modules/uc4-analysis/adapters/AuditLogger'
import type {
  Organization,
  OrganizationReader,
  PartnerChannel,
} from '@/modules/uc4-analysis/adapters/PartnerChannel'
import type { ShareLogRepository } from '@/modules/uc4-analysis/adapters/ShareLogRepository'
import type { SnapshotRepository } from '@/modules/uc4-analysis/adapters/SnapshotRepository'
import { PrismaShareLogRepository } from '@/modules/uc4-analysis/adapters/prisma/PrismaShareLogRepository'
import { PrismaSnapshotRepository } from '@/modules/uc4-analysis/adapters/prisma/PrismaSnapshotRepository'
import type { AnalysisReport } from '@/modules/uc4-analysis/domain/AnalysisReport'
import type { Metrics } from '@/modules/uc4-analysis/domain/Metrics'
import type {
  IncludedSection,
  Language,
  ReportFilters,
} from '@/modules/uc4-analysis/domain/ReportFilters'
import type { ShareOutcome } from '@/modules/uc4-analysis/domain/ShareOutcome'
import { AggregationService } from '@/modules/uc4-analysis/services/AggregationService'
import { ReachCalculator } from '@/modules/uc4-analysis/services/ReachCalculator'
import { ReportFilterValidator } from '@/modules/uc4-analysis/services/ReportFilterValidator'
import type { ValidatedFilters } from '@/modules/uc4-analysis/services/ReportFilterValidator'
import { ShareService } from '@/modules/uc4-analysis/services/ShareService'
import { SnapshotService } from '@/modules/uc4-analysis/services/SnapshotService'
import { PrismaAuditRepository } from '@/modules/uc2-report/adapters/PrismaAuditRepository'
import { DecisionQueryService } from '@/modules/uc2-report/services/DecisionQueryService'

// ─── Time control ─────────────────────────────────────────────────────────────
//
// SnapshotService derives its aggregation deadline as `clock.now() + 60s` and
// AggregationService races real database reads against that deadline with a
// plain setTimeout. Node clamps any timeout > 2^31-1 ms (~24.86 days) down to
// 1 ms, so the fixed clock must satisfy BOTH:
//   1. deadline > wall clock      (otherwise remainingMs clamps to 0 → instant
//                                  AggregationTimeoutError for every generate)
//   2. deadline − wall clock < 2^31-1 ms (otherwise the timer clamps to 1 ms
//                                  and the real Prisma reads always lose)
// 2026-11-01T00:00:00Z (the spec's 2026-09-01 example is already in the past
// relative to the wall clock) sits inside that window while the wall clock is
// between 2026-10-07 and 2026-11-01; outside it we fall back to a clock 7 days
// ahead of the wall clock so the suite keeps working whenever it is run.

const PREFERRED_FIXED_NOW = new Date('2026-11-01T00:00:00.000Z')
const FALLBACK_OFFSET_MS = 7 * 24 * 60 * 60 * 1000
const MAX_TIMER_MS = 2 ** 31 - 1

function withinTimerRange(deadlineMs: number): boolean {
  const remaining = deadlineMs - Date.now()
  return remaining > 5_000 && remaining < MAX_TIMER_MS - 60_000
}

/** 'preferred' = fixed spec-style clock, 'adjusted' = wall clock + 7 days. */
export const CLOCK_MODE: 'preferred' | 'adjusted' = withinTimerRange(
  PREFERRED_FIXED_NOW.getTime() + 60_000,
)
  ? 'preferred'
  : 'adjusted'

/** Fixed clock used by every service under test (checks never read the wall clock). */
export const FIXED_NOW: Date =
  CLOCK_MODE === 'preferred'
    ? PREFERRED_FIXED_NOW
    : new Date(Date.now() + FALLBACK_OFFSET_MS)

/** Aggregation deadline handed to direct AggregationService.aggregate calls. */
export const DEADLINE: Date = new Date(FIXED_NOW.getTime() + 60_000)

/** Clock whose deadline is already in the past → deterministic timeout tests. */
export const EXPIRED_NOW = new Date('2020-01-01T00:00:00.000Z')

/** Report window: Kegalle flood event, August 2026 (all seeded rows live here). */
export const WINDOW = { from: '2026-08-01', to: '2026-08-31' } as const

export const ALL_SECTIONS: IncludedSection[] = [
  'ALERTS',
  'REACH',
  'REPORTS',
  'SHELTERS',
  'SUPPLIES',
]

// ─── Seed data ────────────────────────────────────────────────────────────────

export interface SeedData {
  kegalleDistrictId: string
  gampahaDistrictId: string
  dmcOfficerId: string
  dutyOfficerId: string
  districtOfficerId: string
  reporterCitizenId: string
  /** The 1 000 citizens reached by the seeded notification attempts. */
  citizenIds: string[]
  /** reporter + the 1 000 above — every citizen row created by this suite. */
  allCitizenIds: string[]
  ngoOrgId: string
  armedOrgId: string
  donorOrgId: string
  alertIds: string[]
  groundReportIds: string[]
  shelterIds: string[]
  stockIds: string[]
  distributionIds: string[]
  officerIds: string[]
  createdOrgIds: string[]
  createdDistrictIds: string[]
}

/** Row counts the seed is expected to produce (asserted by check A.5). */
export const SEED_SPEC = {
  districts: 1,
  officers: 3,
  organizations: 3,
  citizens: 1001,
  alertTargets: 3,
  alerts: 3,
  attempts: 2000,
  groundReports: 51,
  auditEntries: 51,
  shelters: 2,
  occupancyEvents: 10,
  stocks: 3,
  distributions: 4,
} as const

/** Seeded partner organisations (created fresh, deleted on cleanup). */
export function seedOrganizations(seed: SeedData): Organization[] {
  return [
    { id: seed.ngoOrgId, name: 'UC4 Test Relief NGO', type: 'NGO' },
    { id: seed.armedOrgId, name: 'UC4 Test Armed Forces', type: 'ARMED_FORCES' },
    { id: seed.donorOrgId, name: 'UC4 Test Private Donors', type: 'PRIVATE_DONOR' },
  ]
}

export function dmcActor(seed: SeedData): Actor {
  return { id: seed.dmcOfficerId, role: 'DMC_OFFICIAL' }
}

export async function seedData(): Promise<SeedData> {
  // ── PART A: Defensive pre-cleanup — remove leftover 'UC4 Test' rows ──
  // This makes seedData() idempotent across multiple test runs.
  // Only delete rows that were created by this test suite (identified by 'UC4' prefix).
  // We do NOT delete the Kegalle district here - we'll handle it below.
  const existingOrgs = await prisma.organization.findMany({
    where: { name: { startsWith: 'UC4 Test' } },
    select: { id: true },
  })
  const existingOfficers = await prisma.officer.findMany({
    where: { name: { startsWith: 'UC4 ' } },
    select: { id: true },
  })

  // Delete organizations and officers first (they're parents)
  // But we need to delete their children first to avoid FK violations
  // For organizations: delete shelter, rescueTeam, supplyStock, reportShare, distribution
  await prisma.reportShare.deleteMany({ where: { organizationId: { in: existingOrgs.map(o => o.id) } } }).catch(() => {})
  await prisma.shelter.deleteMany({ where: { organizationId: { in: existingOrgs.map(o => o.id) } } }).catch(() => {})
  await prisma.supplyStock.deleteMany({ where: { organizationId: { in: existingOrgs.map(o => o.id) } } }).catch(() => {})
  await prisma.distribution.deleteMany({ where: { organizationId: { in: existingOrgs.map(o => o.id) } } }).catch(() => {})
  await prisma.organization.deleteMany({ where: { id: { in: existingOrgs.map(o => o.id) } } }).catch(() => {})

  // For officers: delete hazardAlert, reportAuditEntry, occupancyEvent, distribution, analysisReport, reportShare
  await prisma.hazardAlert.deleteMany({ where: { issuedById: { in: existingOfficers.map(o => o.id) } } }).catch(() => {})
  await prisma.analysisReport.deleteMany({ where: { generatedBy: { in: existingOfficers.map(o => o.id) } } }).catch(() => {})
  await prisma.officer.deleteMany({ where: { id: { in: existingOfficers.map(o => o.id) } } }).catch(() => {})

  // Now handle Kegalle district if it exists from a previous run
  const existingKegalle = await prisma.district.findUnique({ where: { name: 'Kegalle' } })
  if (existingKegalle) {
    const kegalleId = existingKegalle.id
    // Delete all child data for this district
    await prisma.alertTargetDistrict.deleteMany({ where: { districtId: kegalleId } }).catch(() => {})
    await prisma.notificationAttempt.deleteMany({ where: { districtId: kegalleId } }).catch(() => {})
    await prisma.reportAuditEntry.deleteMany({ where: { districtId: kegalleId } }).catch(() => {})
    await prisma.groundReport.deleteMany({ where: { districtId: kegalleId } }).catch(() => {})
    await prisma.occupancyEvent.deleteMany({ where: { districtId: kegalleId } }).catch(() => {})
    await prisma.distribution.deleteMany({ where: { districtId: kegalleId } }).catch(() => {})
    await prisma.shelter.deleteMany({ where: { districtId: kegalleId } }).catch(() => {})
    await prisma.supplyStock.deleteMany({ where: { districtId: kegalleId } }).catch(() => {})
    await prisma.citizen.deleteMany({ where: { districtId: kegalleId } }).catch(() => {})
    // Delete the district itself
    await prisma.district.delete({ where: { id: kegalleId } }).catch(() => {})
  }

  // ── Districts: reuse baseline rows, create Kegalle (the event district) ──
  const createdDistrictIds: string[] = []
  let kegalle = await prisma.district.findUnique({ where: { name: 'Kegalle' } })
  if (kegalle === null) {
    kegalle = await prisma.district.create({ data: { name: 'Kegalle' } })
    createdDistrictIds.push(kegalle.id)
  }
  const gampaha = await prisma.district.findUnique({ where: { name: 'Gampaha' } })
  if (gampaha === null) {
    throw new Error('Baseline district "Gampaha" is missing — run `npx prisma db seed` first.')
  }

  // ── PART B: Create entities (after cleanup) ──
  // Officers (FK targets for analysis_report / hazard_alert / events)
  // Delete any existing UC4 officers first to avoid conflicts
  const existingOfficersToDelete = await prisma.officer.findMany({
    where: { name: { in: ['UC4 DMC Official', 'UC4 Duty Officer', 'UC4 District Officer'] } },
    select: { id: true },
  })
  await prisma.officer.deleteMany({ where: { id: { in: existingOfficersToDelete.map(o => o.id) } } }).catch(() => {})
  const dmc = await prisma.officer.create({
    data: { name: 'UC4 DMC Official', role: 'DMC_OFFICIAL' },
  })
  const duty = await prisma.officer.create({
    data: { name: 'UC4 Duty Officer', role: 'DUTY_OFFICER' },
  })
  const districtOfficer = await prisma.officer.create({
    data: { name: 'UC4 District Officer', role: 'DISTRICT_OFFICER' },
  })
  const officerIds = [dmc.id, duty.id, districtOfficer.id]

  // Partner organisations (unique names on 'name' field → upsert to handle any edge cases)
  const ngo = await prisma.organization.upsert({
    where: { name: 'UC4 Test Relief NGO' },
    update: {},
    create: { name: 'UC4 Test Relief NGO', type: 'NGO' },
  })
  const armed = await prisma.organization.upsert({
    where: { name: 'UC4 Test Armed Forces' },
    update: {},
    create: { name: 'UC4 Test Armed Forces', type: 'ARMED_FORCES' },
  })
  const donor = await prisma.organization.upsert({
    where: { name: 'UC4 Test Private Donors' },
    update: {},
    create: { name: 'UC4 Test Private Donors', type: 'PRIVATE_DONOR' },
  })
  const createdOrgIds = [ngo.id, armed.id, donor.id]

  // ── Reporter citizen (FK target for ground_report.reporter_id) ──
  // Delete any existing UC4 Reporter first to avoid unique constraint issues
  await prisma.citizen.deleteMany({ where: { name: 'UC4 Reporter' } }).catch(() => {})
  const reporter = await prisma.citizen.create({
    data: { name: 'UC4 Reporter', isVolunteer: false, districtId: kegalle.id },
  })

  // ── 3 FLOOD alerts targeting Kegalle, Aug 2026 ──
  const alertIds: string[] = []
  for (let i = 1; i <= 3; i += 1) {
    const alert = await prisma.hazardAlert.create({
      data: {
        hazardType: 'FLOOD',
        severity: 'WARNING',
        status: 'ACTIVE',
        message: `UC4 seeded flood alert ${i}`,
        issuedById: dmc.id,
        occurredAt: new Date(`2026-08-0${i}T06:00:00.000Z`),
      },
    })
    await prisma.alertTargetDistrict.create({
      data: { alertId: alert.id, districtId: kegalle.id },
    })
    alertIds.push(alert.id)
  }

  // ── 1 000 citizens + 2 000 delivery attempts (2 channels each) ──
  //
  //   citizens   0-849 → PUSH DELIVERED + SMS DELIVERED
  //   citizens 850-949 → PUSH DELIVERED + SMS FAILED
  //   citizens 950-999 → PUSH FAILED    + SMS DELIVERED
  //
  //   → distinct delivered citizens = 1 000
  //   → PUSH {attempted 1000, delivered 950, failed 50}
  //   → SMS  {attempted 1000, delivered 900, failed 100}
  //   → delivered sum 1 850 ≠ distinct 1 000 (BR4 non-additive)
  const citizenIds: string[] = []
  for (let i = 0; i < 1000; i += 1) {
    citizenIds.push(crypto.randomUUID())
  }
  await prisma.citizen.createMany({
    data: citizenIds.map((id, index) => ({
      id,
      name: `UC4 Reached Citizen ${index + 1}`,
      isVolunteer: false,
      districtId: kegalle.id,
    })),
  })

  const occurredAt = new Date('2026-08-01T05:00:00.000Z')
  const attempts: Array<{
    id: string
    alertId: string
    citizenId: string
    districtId: string
    hazardType: HazardType
    channel: 'PUSH' | 'SMS'
    status: 'DELIVERED' | 'FAILED'
    kind: 'ISSUE'
    occurredAt: Date
    sentAt: Date
  }> = []
  for (let i = 0; i < citizenIds.length; i += 1) {
    const pushStatus: 'DELIVERED' | 'FAILED' = i >= 950 ? 'FAILED' : 'DELIVERED'
    const smsStatus: 'DELIVERED' | 'FAILED' = i >= 850 && i < 950 ? 'FAILED' : 'DELIVERED'
    attempts.push({
      id: crypto.randomUUID(),
      alertId: alertIds[0],
      citizenId: citizenIds[i],
      districtId: kegalle.id,
      hazardType: 'FLOOD',
      channel: 'PUSH',
      status: pushStatus,
      kind: 'ISSUE',
      occurredAt,
      sentAt: occurredAt,
    })
    attempts.push({
      id: crypto.randomUUID(),
      alertId: alertIds[0],
      citizenId: citizenIds[i],
      districtId: kegalle.id,
      hazardType: 'FLOOD',
      channel: 'SMS',
      status: smsStatus,
      kind: 'ISSUE',
      occurredAt,
      sentAt: occurredAt,
    })
  }
  await prisma.notificationAttempt.createMany({ data: attempts })

  // ── 51 ground reports + 51 audit decisions (42 VERIFIED / 6 NEEDS_INFO / 3 REJECTED) ──
  const groundReportIds: string[] = []
  const plan: Array<'VERIFIED' | 'NEEDS_INFO' | 'REJECTED'> = [
    ...Array.from({ length: 42 }, () => 'VERIFIED' as const),
    ...Array.from({ length: 6 }, () => 'NEEDS_INFO' as const),
    ...Array.from({ length: 3 }, () => 'REJECTED' as const),
  ]
  const reportRows: Array<{
    id: string
    localId: string
    reporterId: string
    districtId: string
    hazardType: HazardType
    description: string
    latitude: number
    longitude: number
    locationSource: 'GPS'
    confidence: 'FULL'
    reviewStatus: 'VERIFIED' | 'NEEDS_INFO' | 'REJECTED'
    captureTime: Date
    version: number
  }> = []
  const auditRows: Array<{
    id: string
    reportId: string
    action: 'VERIFIED' | 'NEEDS_INFO' | 'REJECTED'
    officerId: string
    occurredAt: Date
    districtId: string
    hazardType: HazardType
  }> = []
  plan.forEach((action, index) => {
    const id = crypto.randomUUID()
    const day = String(1 + (index % 24)).padStart(2, '0')
    groundReportIds.push(id)
    reportRows.push({
      id,
      localId: `GR-${id}`,
      reporterId: reporter.id,
      districtId: kegalle.id,
      hazardType: 'FLOOD',
      description: `UC4 seeded ground report ${index + 1}`,
      latitude: 7.25,
      longitude: 80.35,
      locationSource: 'GPS',
      confidence: 'FULL',
      reviewStatus: action,
      captureTime: new Date(`2026-08-${day}T08:00:00.000Z`),
      version: 1,
    })
    auditRows.push({
      id: crypto.randomUUID(),
      reportId: id,
      action,
      officerId: dmc.id,
      occurredAt: new Date(`2026-08-${day}T12:00:00.000Z`),
      districtId: kegalle.id,
      hazardType: 'FLOOD',
    })
  })
  await prisma.groundReport.createMany({ data: reportRows })
  await prisma.reportAuditEntry.createMany({ data: auditRows })

  // ── 2 shelters × 5 occupancy events (peak 250, activated 2) ──
  const shelterIds: string[] = []
  const occupancyRows: Array<{
    id: string
    shelterId: string
    districtId: string
    previousCount: number
    newCount: number
    actorId: string
    occurredAt: Date
    actionId: string
  }> = []
  for (let s = 1; s <= 2; s += 1) {
    const shelter = await prisma.shelter.create({
      data: {
        districtId: kegalle.id,
        organizationId: armed.id,
        name: `UC4 Test Shelter ${s}`,
        address: `UC4 Test Address ${s}`,
        capacity: 500,
        occupancy: 0,
        status: 'OPEN',
        version: 1,
      },
    })
    shelterIds.push(shelter.id)
    for (let e = 1; e <= 5; e += 1) {
      occupancyRows.push({
        id: crypto.randomUUID(),
        shelterId: shelter.id,
        districtId: kegalle.id,
        previousCount: (e - 1) * 50,
        newCount: e * 50,
        actorId: dmc.id,
        occurredAt: new Date(`2026-08-0${e}T10:00:00.000Z`),
        actionId: `OCC-${crypto.randomUUID()}`,
      })
    }
  }
  await prisma.occupancyEvent.createMany({ data: occupancyRows })

  // ── 3 supply stocks + 4 distributions ──
  //
  //   FOOD     3 000 + 2 000 distributed / 10 000 on hand → 50 %
  //   WATER    5 000 / 10 000                             → 50 %
  //   MEDICINE   100 / 0                                  → null (BR10)
  const food = await prisma.supplyStock.create({
    data: { organizationId: ngo.id, districtId: kegalle.id, supplyType: 'FOOD', onHand: 10000 },
  })
  const water = await prisma.supplyStock.create({
    data: { organizationId: ngo.id, districtId: kegalle.id, supplyType: 'WATER', onHand: 10000 },
  })
  const medicine = await prisma.supplyStock.create({
    data: { organizationId: ngo.id, districtId: kegalle.id, supplyType: 'MEDICINE', onHand: 0 },
  })
  const stockIds = [food.id, water.id, medicine.id]
  await prisma.distribution.createMany({
    data: [
      {
        id: crypto.randomUUID(),
        stockId: food.id,
        destinationShelterId: shelterIds[0],
        organizationId: ngo.id,
        districtId: kegalle.id,
        quantity: 3000,
        actorId: dmc.id,
        occurredAt: new Date('2026-08-03T09:00:00.000Z'),
        actionId: `DIST-${crypto.randomUUID()}`,
      },
      {
        id: crypto.randomUUID(),
        stockId: food.id,
        destinationShelterId: shelterIds[1],
        organizationId: ngo.id,
        districtId: kegalle.id,
        quantity: 2000,
        actorId: dmc.id,
        occurredAt: new Date('2026-08-04T09:00:00.000Z'),
        actionId: `DIST-${crypto.randomUUID()}`,
      },
      {
        id: crypto.randomUUID(),
        stockId: water.id,
        destinationShelterId: shelterIds[1],
        organizationId: ngo.id,
        districtId: kegalle.id,
        quantity: 5000,
        actorId: dmc.id,
        occurredAt: new Date('2026-08-07T09:00:00.000Z'),
        actionId: `DIST-${crypto.randomUUID()}`,
      },
      {
        id: crypto.randomUUID(),
        stockId: medicine.id,
        destinationShelterId: shelterIds[0],
        organizationId: ngo.id,
        districtId: kegalle.id,
        quantity: 100,
        actorId: dmc.id,
        occurredAt: new Date('2026-08-08T09:00:00.000Z'),
        actionId: `DIST-${crypto.randomUUID()}`,
      },
    ],
  })
  const distributionIds = await prisma.distribution
    .findMany({ where: { districtId: kegalle.id }, select: { id: true } })
    .then((rows) => rows.map((row) => row.id))

  return {
    kegalleDistrictId: kegalle.id,
    gampahaDistrictId: gampaha.id,
    dmcOfficerId: dmc.id,
    dutyOfficerId: duty.id,
    districtOfficerId: districtOfficer.id,
    reporterCitizenId: reporter.id,
    citizenIds,
    allCitizenIds: [reporter.id, ...citizenIds],
    ngoOrgId: ngo.id,
    armedOrgId: armed.id,
    donorOrgId: donor.id,
    alertIds,
    groundReportIds,
    shelterIds,
    stockIds,
    distributionIds,
    officerIds,
    createdOrgIds,
    createdDistrictIds,
  }
}

// ─── Row accounting & cleanup ─────────────────────────────────────────────────

export interface OurRowCounts {
  reports: number
  shares: number
  alerts: number
  alertTargets: number
  attempts: number
  groundReports: number
  auditEntries: number
  occupancyEvents: number
  distributions: number
  shelters: number
  stocks: number
  citizens: number
  officers: number
  organizations: number
  districts: number
  total: number
}

/** Rows owned by this suite — used for created/cleaned accounting. */
export async function countOurRows(seed: SeedData): Promise<OurRowCounts> {
  const [
    reports,
    shares,
    alerts,
    alertTargets,
    attempts,
    groundReports,
    auditEntries,
    occupancyEvents,
    distributions,
    shelters,
    stocks,
    citizens,
    officers,
    organizations,
    districts,
  ] = await Promise.all([
    prisma.analysisReport.count({ where: { generatedBy: { in: seed.officerIds } } }),
    prisma.reportShare.count({ where: { actorId: { in: seed.officerIds } } }),
    prisma.hazardAlert.count({ where: { issuedById: { in: seed.officerIds } } }),
    prisma.alertTargetDistrict.count({ where: { districtId: seed.kegalleDistrictId } }),
    prisma.notificationAttempt.count({ where: { districtId: seed.kegalleDistrictId } }),
    prisma.groundReport.count({ where: { districtId: seed.kegalleDistrictId } }),
    prisma.reportAuditEntry.count({ where: { districtId: seed.kegalleDistrictId } }),
    prisma.occupancyEvent.count({ where: { districtId: seed.kegalleDistrictId } }),
    prisma.distribution.count({ where: { districtId: seed.kegalleDistrictId } }),
    prisma.shelter.count({ where: { districtId: seed.kegalleDistrictId } }),
    prisma.supplyStock.count({ where: { id: { in: seed.stockIds } } }),
    prisma.citizen.count({ where: { id: { in: seed.allCitizenIds } } }),
    prisma.officer.count({ where: { id: { in: seed.officerIds } } }),
    prisma.organization.count({ where: { id: { in: seed.createdOrgIds } } }),
    prisma.district.count({ where: { id: { in: seed.createdDistrictIds } } }),
  ])
  const total =
    reports +
    shares +
    alerts +
    alertTargets +
    attempts +
    groundReports +
    auditEntries +
    occupancyEvents +
    distributions +
    shelters +
    stocks +
    citizens +
    officers +
    organizations +
    districts
  return {
    reports,
    shares,
    alerts,
    alertTargets,
    attempts,
    groundReports,
    auditEntries,
    occupancyEvents,
    distributions,
    shelters,
    stocks,
    citizens,
    officers,
    organizations,
    districts,
    total,
  }
}

/**
 * Delete every row created by the suite, in FK-safe order.
 * Each step is isolated so one failure cannot hide the rest (and cannot mask
 * the real test failures reported by the caller).
 *
 * @returns one message per failed step (empty array = clean)
 */
export async function cleanupData(seed: SeedData): Promise<string[]> {
  const failures: string[] = []
  const steps: ReadonlyArray<readonly [string, () => Promise<unknown>]> = [
    ['reportShare', () => prisma.reportShare.deleteMany({ where: { actorId: { in: seed.officerIds } } })],
    ['analysisReport', () => prisma.analysisReport.deleteMany({ where: { generatedBy: { in: seed.officerIds } } })],
    ['reportAuditEntry', () => prisma.reportAuditEntry.deleteMany({ where: { districtId: seed.kegalleDistrictId } })],
    ['groundReport', () => prisma.groundReport.deleteMany({ where: { districtId: seed.kegalleDistrictId } })],
    ['notificationAttempt', () => prisma.notificationAttempt.deleteMany({ where: { districtId: seed.kegalleDistrictId } })],
    ['alertTargetDistrict', () => prisma.alertTargetDistrict.deleteMany({ where: { districtId: seed.kegalleDistrictId } })],
    ['hazardAlert', () => prisma.hazardAlert.deleteMany({ where: { issuedById: { in: seed.officerIds } } })],
    ['occupancyEvent', () => prisma.occupancyEvent.deleteMany({ where: { districtId: seed.kegalleDistrictId } })],
    ['distribution', () => prisma.distribution.deleteMany({ where: { districtId: seed.kegalleDistrictId } })],
    ['shelter', () => prisma.shelter.deleteMany({ where: { districtId: seed.kegalleDistrictId } })],
    ['supplyStock', () => prisma.supplyStock.deleteMany({ where: { id: { in: seed.stockIds } } })],
    ['citizen', () => prisma.citizen.deleteMany({ where: { id: { in: seed.allCitizenIds } } })],
    ['officer', () => prisma.officer.deleteMany({ where: { id: { in: seed.officerIds } } })],
    ['organization', () => prisma.organization.deleteMany({ where: { id: { in: seed.createdOrgIds } } })],
    ['district', () => prisma.district.deleteMany({ where: { id: { in: seed.createdDistrictIds } } })],
  ]
  for (const [name, run] of steps) {
    try {
      await run()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failures.push(`${name}: ${message}`)
    }
  }
  return failures
}

// ─── Prisma-backed reader adapters ───────────────────────────────────────────
//
// UC1 / UC3 have not shipped their reader implementations yet, so the suite
// implements the five shared Reader contracts directly against Prisma with
// the semantics documented in @/shared/contracts/types:
//   alerts        → window on occurred_at, cutoff on created_at, district via
//                   alert_target_district
//   attempts      → window + cutoff on occurred_at, district column
//   occupancy     → window + cutoff on occurred_at, district column
//   distributions → window + cutoff on occurred_at, total = supply_stock.on_hand
// Decisions use the REAL UC2 reader (DecisionQueryService +
// PrismaAuditRepository), so the UC2 → UC4 integration path is exercised.

export interface DbReaders {
  alerts: AlertReader
  attempts: AttemptReader
  decisions: ReportDecisionReader
  occupancy: OccupancyEventReader
  distributions: DistributionReader
  supplyStocks: SupplyStockReader
}

function windowClause(filter: Filter): { gte?: Date; lte?: Date } | undefined {
  if (filter.from === undefined && filter.to === undefined) {
    return undefined
  }
  const range: { gte?: Date; lte?: Date } = {}
  if (filter.from !== undefined) range.gte = filter.from
  if (filter.to !== undefined) range.lte = filter.to
  return range
}

export class PrismaAlertReader implements AlertReader {
  async listAlerts(filter: Filter): Promise<HazardAlert[]> {
    const clauses: Prisma.HazardAlertWhereInput[] = []
    const range = windowClause(filter)
    if (range !== undefined) clauses.push({ occurredAt: range })
    if (filter.districtId !== undefined) {
      clauses.push({ targetDistricts: { some: { districtId: filter.districtId } } })
    }
    if (filter.hazardType !== undefined) clauses.push({ hazardType: filter.hazardType })
    if (filter.cutoff !== undefined) clauses.push({ createdAt: { lte: filter.cutoff } })

    const rows = await prisma.hazardAlert.findMany({
      where: clauses.length > 0 ? { AND: clauses } : {},
      orderBy: { occurredAt: 'asc' },
    })
    return rows.map((row) => ({
      id: row.id,
      hazardType: row.hazardType,
      severity: row.severity,
      occurredAt: row.occurredAt,
    }))
  }
}

export class PrismaAttemptReader implements AttemptReader {
  async listAttempts(filter: Filter): Promise<NotificationAttempt[]> {
    const clauses: Prisma.NotificationAttemptWhereInput[] = []
    const range = windowClause(filter)
    if (range !== undefined) clauses.push({ occurredAt: range })
    if (filter.districtId !== undefined) clauses.push({ districtId: filter.districtId })
    if (filter.hazardType !== undefined) clauses.push({ hazardType: filter.hazardType })
    if (filter.cutoff !== undefined) clauses.push({ occurredAt: { lte: filter.cutoff } })

    const rows = await prisma.notificationAttempt.findMany({
      where: clauses.length > 0 ? { AND: clauses } : {},
      orderBy: { occurredAt: 'asc' },
    })
    return rows.map((row) => ({
      id: row.id,
      alertId: row.alertId,
      citizenId: row.citizenId,
      districtId: row.districtId,
      hazardType: row.hazardType,
      channel: row.channel,
      deliveryStatus: row.status,
      occurredAt: row.occurredAt,
      attemptAt: row.sentAt ?? row.occurredAt,
    }))
  }
}

export class PrismaOccupancyReader implements OccupancyEventReader {
  async listEvents(filter: Filter): Promise<OccupancyEvent[]> {
    const clauses: Prisma.OccupancyEventWhereInput[] = []
    const range = windowClause(filter)
    if (range !== undefined) clauses.push({ occurredAt: range })
    if (filter.districtId !== undefined) clauses.push({ districtId: filter.districtId })
    if (filter.cutoff !== undefined) clauses.push({ occurredAt: { lte: filter.cutoff } })

    const rows = await prisma.occupancyEvent.findMany({
      where: clauses.length > 0 ? { AND: clauses } : {},
      orderBy: { occurredAt: 'asc' },
    })
    return rows.map((row) => ({
      id: row.id,
      shelterId: row.shelterId,
      districtId: row.districtId,
      previousCount: row.previousCount,
      newCount: row.newCount,
      occurredAt: row.occurredAt,
    }))
  }
}

export class PrismaDistributionReader implements DistributionReader {
  async listDistributions(filter: Filter): Promise<Distribution[]> {
    const clauses: Prisma.DistributionWhereInput[] = []
    const range = windowClause(filter)
    if (range !== undefined) clauses.push({ occurredAt: range })
    if (filter.districtId !== undefined) clauses.push({ districtId: filter.districtId })
    if (filter.cutoff !== undefined) clauses.push({ occurredAt: { lte: filter.cutoff } })

    const rows = await prisma.distribution.findMany({
      where: clauses.length > 0 ? { AND: clauses } : {},
      include: { stock: true },
      orderBy: { occurredAt: 'asc' },
    })
    return rows.map((row) => ({
      id: row.id,
      supplyType: row.stock.supplyType,
      districtId: row.districtId,
      distributed: row.quantity,
      total: row.stock.onHand,
      occurredAt: row.occurredAt,
    }))
  }
}

/** The REAL UC2 decision reader (UC2 → UC4 integration path). */
export function realDecisionReader(): ReportDecisionReader {
  return new DecisionQueryService(new PrismaAuditRepository())
}

export class PrismaSupplyStockReaderImpl implements SupplyStockReader {
  async listStocks(filter: Filter): Promise<SupplyStock[]> {
    const clauses: Prisma.SupplyStockWhereInput[] = []
    if (filter.districtId !== undefined) clauses.push({ districtId: filter.districtId })
    if (filter.cutoff !== undefined) clauses.push({ updatedAt: { lte: filter.cutoff } })
    const rows = await prisma.supplyStock.findMany({
      where: clauses.length > 0 ? { AND: clauses } : {},
      orderBy: { updatedAt: 'asc' },
    })
    return rows.map((row) => ({
      id: row.id,
      organizationId: row.organizationId,
      districtId: row.districtId,
      supplyType: row.supplyType,
      onHand: row.onHand,
      updatedAt: row.updatedAt,
    }))
  }
}

export function dbReaders(): DbReaders {
  return {
    alerts: new PrismaAlertReader(),
    attempts: new PrismaAttemptReader(),
    decisions: realDecisionReader(),
    occupancy: new PrismaOccupancyReader(),
    distributions: new PrismaDistributionReader(),
    supplyStocks: new PrismaSupplyStockReaderImpl(),
  }
}

/** Readers whose promises never settle → the deadline always wins (BR6). */
export function neverReaders(): DbReaders {
  const never = <T>(): Promise<T> => new Promise<T>(() => undefined)
  return {
    alerts: { listAlerts: () => never<HazardAlert[]>() },
    attempts: { listAttempts: () => never<NotificationAttempt[]>() },
    decisions: { listDecisions: () => never<ReportDecision[]>() },
    occupancy: { listEvents: () => never<OccupancyEvent[]>() },
    distributions: { listDistributions: () => never<Distribution[]>() },
    supplyStocks: { listStocks: () => never<SupplyStock[]>() },
  }
}

/**
 * Records the Filter object handed to each reader (BR5: one shared filter)
 * while delegating to the real Prisma readers. Structurally satisfies
 * DbReaders, so it can be passed straight to makeAggregation().
 */
export class RecordingReaders implements DbReaders {
  readonly filters: Filter[] = []
  readonly alerts: AlertReader
  readonly attempts: AttemptReader
  readonly decisions: ReportDecisionReader
  readonly occupancy: OccupancyEventReader
  readonly distributions: DistributionReader
  readonly supplyStocks: SupplyStockReader

  constructor(inner: DbReaders = dbReaders()) {
    this.alerts = {
      listAlerts: async (filter) => {
        this.filters.push(filter)
        return inner.alerts.listAlerts(filter)
      },
    }
    this.attempts = {
      listAttempts: async (filter) => {
        this.filters.push(filter)
        return inner.attempts.listAttempts(filter)
      },
    }
    this.decisions = {
      listDecisions: async (filter) => {
        this.filters.push(filter)
        return inner.decisions.listDecisions(filter)
      },
    }
    this.occupancy = {
      listEvents: async (filter) => {
        this.filters.push(filter)
        return inner.occupancy.listEvents(filter)
      },
    }
    this.distributions = {
      listDistributions: async (filter) => {
        this.filters.push(filter)
        return inner.distributions.listDistributions(filter)
      },
    }
    this.supplyStocks = {
      listStocks: async (filter) => {
        this.filters.push(filter)
        return inner.supplyStocks.listStocks(filter)
      },
    }
  }
}

// ─── Test doubles for injected ports ──────────────────────────────────────────

export class TestAuditLogger implements AuditLogger {
  readonly generations: Array<{ reportId: string; actorId: string }> = []
  readonly failures: Array<{ reason: string; actorId: string }> = []
  readonly shares: Array<{ reportId: string; actorId: string; count: number }> = []

  logGeneration(reportId: string, actorId: string): void {
    this.generations.push({ reportId, actorId })
  }

  logFailure(reason: string, actorId: string): void {
    this.failures.push({ reason, actorId })
  }

  logShare(reportId: string, outcomes: ShareOutcome[], actorId: string): void {
    this.shares.push({ reportId, actorId, count: outcomes.length })
  }
}

export class StaticOrganizationReader implements OrganizationReader {
  private readonly organizations: Organization[]

  constructor(organizations: Organization[]) {
    this.organizations = organizations
  }

  getById(id: string): Organization | null {
    return this.organizations.find((organization) => organization.id === id) ?? null
  }
}

/** Deterministic RNG for MockPartnerChannel: value < failureRate → send fails. */
export class ScriptedRng {
  private readonly values: number[]

  constructor(values: number[]) {
    this.values = [...values]
  }

  next(): number {
    return this.values.shift() ?? 1
  }
}

/** Ids must be UUIDs — analysis_report.id / report_share.id are @db.Uuid. */
export class UuidIdGenerator implements IdGenerator {
  next(): string {
    return crypto.randomUUID()
  }
}

// ─── Service builders ─────────────────────────────────────────────────────────

export function fixedClock(): Clock {
  return { now: () => new Date(FIXED_NOW.getTime()) }
}

export function expiredClock(): Clock {
  return { now: () => new Date(EXPIRED_NOW.getTime()) }
}

export function makeAggregation(readers: DbReaders): AggregationService {
  return new AggregationService(
    readers.alerts,
    readers.attempts,
    readers.decisions,
    readers.occupancy,
    readers.distributions,
    readers.supplyStocks,
    new ReachCalculator(),
  )
}

export interface SnapshotServiceBundle {
  service: SnapshotService
  audit: TestAuditLogger
  repo: SnapshotRepository
}

export function makeSnapshotService(
  options: { readers?: DbReaders; clock?: Clock; repo?: SnapshotRepository } = {},
): SnapshotServiceBundle {
  const audit = new TestAuditLogger()
  const repo = options.repo ?? new PrismaSnapshotRepository()
  const service = new SnapshotService(
    new ReportFilterValidator(),
    makeAggregation(options.readers ?? dbReaders()),
    repo,
    audit,
    options.clock ?? fixedClock(),
    new UuidIdGenerator(),
  )
  return { service, audit, repo }
}

export interface ShareServiceBundle {
  service: ShareService
  audit: TestAuditLogger
  repo: SnapshotRepository
  shareLog: ShareLogRepository
}

export function makeShareService(
  seed: SeedData,
  channel: PartnerChannel,
  options: { clock?: Clock; repo?: SnapshotRepository } = {},
): ShareServiceBundle {
  const audit = new TestAuditLogger()
  const repo = options.repo ?? new PrismaSnapshotRepository()
  const shareLog = new PrismaShareLogRepository()
  const service = new ShareService(
    repo,
    shareLog,
    channel,
    new StaticOrganizationReader(seedOrganizations(seed)),
    audit,
    options.clock ?? fixedClock(),
    new UuidIdGenerator(),
  )
  return { service, audit, repo, shareLog }
}

// ─── Filter helpers ───────────────────────────────────────────────────────────

export interface FilterInputOptions {
  sections?: IncludedSection[]
  language?: Language
  districtId?: string
  hazardType?: HazardType
}

/** Untrusted input exactly as the API body / UI would send it. */
export function filterInput(
  seed: SeedData,
  options: FilterInputOptions = {},
): Record<string, unknown> {
  return {
    from: WINDOW.from,
    to: WINDOW.to,
    districtId: options.districtId ?? seed.kegalleDistrictId,
    hazardType: options.hazardType ?? 'FLOOD',
    includedSections: options.sections ?? ALL_SECTIONS,
    language: options.language ?? 'EN',
  }
}

/** Same input, validated — for direct AggregationService.aggregate calls. */
export function validatedFilters(
  seed: SeedData,
  options: FilterInputOptions = {},
): ValidatedFilters {
  return new ReportFilterValidator().validate(filterInput(seed, options))
}

// ─── Snapshot helpers ─────────────────────────────────────────────────────────

export function zeroMetrics(): Metrics {
  return {
    alerts: { total: 0, bySeverity: {}, byHazardType: {} },
    reach: {
      distinctCitizens: 0,
      perChannel: {
        PUSH: { attempted: 0, delivered: 0, failed: 0 },
        SMS: { attempted: 0, delivered: 0, failed: 0 },
      },
    },
    reports: { verified: 0, rejected: 0, pending: 0 },
    shelters: { activated: 0, peakOccupancy: 0, events: [] },
    supplies: { byType: {} },
  }
}

/** Build (without saving) a frozen snapshot for share/PDF tests. */
export function buildSnapshot(
  seed: SeedData,
  overrides: { filters?: ReportFilters; warningFlag?: boolean; metrics?: Metrics } = {},
): AnalysisReport {
  const filters = overrides.filters ?? validatedFilters(seed)
  return Object.freeze({
    id: crypto.randomUUID(),
    filters,
    sourceCutoff: FIXED_NOW,
    generatedAt: FIXED_NOW,
    generatedBy: seed.dmcOfficerId,
    metrics: overrides.metrics ?? zeroMetrics(),
    warningFlag: overrides.warningFlag ?? false,
  })
}

/** Persist a synthetic snapshot (used by share tests that need a FK row). */
export async function saveSnapshot(
  repo: SnapshotRepository,
  seed: SeedData,
  overrides: { filters?: ReportFilters; warningFlag?: boolean; metrics?: Metrics } = {},
): Promise<AnalysisReport> {
  const report = buildSnapshot(seed, overrides)
  await repo.save(report)
  return report
}

// ─── PDF text extraction ─────────────────────────────────────────────────────
//
// pdf-lib writes FlateDecode-compressed content streams whose text operands
// are hex strings (`<506F...> Tj`). Raw byte scanning finds nothing, so every
// stream is inflated first and both hex and literal operands are decoded.

export function extractPdfText(bytes: Uint8Array): string {
  const raw = Buffer.from(bytes).toString('latin1')
  const chunks: string[] = []
  const streamPattern = /stream\r?\n([\s\S]*?)endstream/g
  const hexPattern = /<([0-9A-Fa-f\s]+)>\s*Tj/g
  const literalPattern = /\((?:\\.|[^\\)])*\)\s*Tj/g

  let streamMatch: RegExpExecArray | null
  while ((streamMatch = streamPattern.exec(raw)) !== null) {
    let content: string
    try {
      content = inflateSync(Buffer.from(streamMatch[1], 'latin1')).toString('latin1')
    } catch {
      continue // not a FlateDecode stream (e.g. the cross-reference stream)
    }

    let hexMatch: RegExpExecArray | null
    while ((hexMatch = hexPattern.exec(content)) !== null) {
      const hex = hexMatch[1].replace(/\s+/g, '')
      let text = ''
      for (let i = 0; i + 1 < hex.length; i += 2) {
        text += String.fromCharCode(Number.parseInt(hex.slice(i, i + 2), 16))
      }
      chunks.push(text)
    }

    let literalMatch: RegExpExecArray | null
    while ((literalMatch = literalPattern.exec(content)) !== null) {
      const operand = literalMatch[0]
        .replace(/^\(/, '')
        .replace(/\)\s*Tj$/, '')
        .replace(/\\([()\\])/g, '$1')
      chunks.push(operand)
    }
  }

  return chunks.join('\n')
}
