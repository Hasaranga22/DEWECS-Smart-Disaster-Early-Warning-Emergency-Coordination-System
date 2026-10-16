import type { Prisma } from '@/generated/prisma/client'
import { isPrisma } from '@/shared/infra/container'
import { prisma } from '@/shared/infra/prisma/client'

import { canSynthesize } from '../adapters/dataBridges'
import { toPrismaReport } from '../adapters/prisma/mappers'
import type { AnalysisReport } from '../domain/AnalysisReport'
import type { Metrics } from '../domain/Metrics'
import type { AggregationService } from '../services/AggregationService'

// ─── Fixed ids shared with the UI (src/app/resources/analysis/_types.ts) ─────

export const KEGALLE = '00000000-0000-4000-8000-000000000001'
export const GAMPAHA = '00000000-0000-4000-8000-000000000002'
export const COLOMBO = '00000000-0000-4000-8000-000000000010'

export const ORG_ARMY = '75700352-5645-41a3-acc7-c8184f09cf35'
export const ORG_WV = '9c343cb9-c47a-4a05-bb4d-be2641a933b4'
export const ORG_DONOR = '656c8a22-e60d-4e32-bfb5-8c5ed132d882'

export const SAMPLE_DMC = '00000000-0004-4000-8000-000000000801'
export const SAMPLE_DUTY = '00000000-0004-4000-8000-000000000802'
export const SAMPLE_DISTRICT_OFFICER = '00000000-0004-4000-8000-000000000803'

export const SHELTER_IDS = [
  '00000000-0000-4000-c000-000000000001', // Kegalle 1
  '00000000-0000-4000-c000-000000000002', // Kegalle 2
  '00000000-0000-4000-c000-000000000003', // Colombo 1
  '00000000-0000-4000-c000-000000000004', // Colombo 2
  '00000000-0000-4000-c000-000000000005', // Gampaha 1
]

export const citizenId = (n: number) => `00000000-0000-4000-a000-${n.toString().padStart(12, '0')}`
export const CITIZEN_IDS = Array.from({ length: 1250 }, (_, i) => citizenId(i + 1))

const ALERT_MARKER = 'Sample UC4 alert'
const REPORT_MARKER = 'sample-report-'
const ACTION_MARKER = 'sample-action-'
const HYDRATE_TIMEOUT_MS = 60_000

// ─── Hydration predicates (pure — unit-tested) ───────────────────────────────

/** SnapshotService's zero-activity rule (BR7): every headline metric empty. */
export function isAllZeroMetrics(metrics: Metrics): boolean {
  return (
    metrics.alerts.total === 0 &&
    metrics.reach.distinctCitizens === 0 &&
    metrics.reports.verified === 0 &&
    metrics.reports.rejected === 0 &&
    metrics.reports.pending === 0 &&
    metrics.shelters.activated === 0 &&
    Object.keys(metrics.supplies.byType).length === 0
  )
}

/**
 * A stored report is worth hydrating when its metrics are still all-zero AND
 * its window may be synthesized (VITEST off, full window, not the Jan 2026
 * empty-period demos — canSynthesize enforces all three).
 */
export function shouldHydrateReport(
  report: Pick<AnalysisReport, 'filters' | 'metrics'>,
): boolean {
  if (!canSynthesize(report.filters.from, report.filters.to)) return false
  return isAllZeroMetrics(report.metrics)
}

// ─── Hydrate ─────────────────────────────────────────────────────────────────

/**
 * Recompute metrics for a zero-KPI stored report using the report's own
 * filters and source cutoff, then persist the fix (Prisma only — the in-memory
 * repo is write-once, so memory mode returns the hydrated view without saving).
 * Any aggregation failure keeps the original report untouched.
 */
export async function hydrateIncompleteSnapshot(
  report: AnalysisReport,
  aggregation: AggregationService,
): Promise<AnalysisReport> {
  if (!shouldHydrateReport(report)) return report

  let metrics: Metrics
  try {
    metrics = await aggregation.aggregate(
      {
        from: report.filters.from,
        to: report.filters.to,
        ...(report.filters.districtId !== undefined
          ? { districtId: report.filters.districtId }
          : {}),
        ...(report.filters.hazardType !== undefined
          ? { hazardType: report.filters.hazardType }
          : {}),
        includedSections: report.filters.includedSections,
        language: report.filters.language,
      },
      report.sourceCutoff,
      // Wall-clock deadline (AggregationService races Date.now() against it) —
      // sourceCutoff is the report's *generation* time, so it is always in the past.
      new Date(Date.now() + HYDRATE_TIMEOUT_MS),
    )
  } catch (error) {
    console.warn(`[uc4] hydration failed for report ${report.id}:`, error)
    return report
  }

  // Still zero after recompute: nothing to hydrate, keep the frozen original.
  if (isAllZeroMetrics(metrics)) return report

  const hydrated: AnalysisReport = Object.freeze({
    ...report,
    metrics,
    warningFlag: false,
  })

  if (isPrisma) {
    const data = toPrismaReport(hydrated)
    await prisma.analysisReport.update({
      where: { id: data.id },
      data: { metrics: data.metrics, warningFlag: data.warningFlag },
    })
  }
  return hydrated
}

// ─── Ensure (source data — mirrors the demo seed's markers) ─────────────────

/**
 * Seed the UC4 demo source data (districts, officers, orgs, citizens, alerts,
 * attempts, ground reports, shelters, stocks) into the ACTIVE store when a
 * source is missing or partial. Every block is gated on marker-row counts, so
 * a fully seeded database is a handful of count queries and no writes.
 *
 * Skipped under VITEST (tests seed their own fixtures) and in memory mode
 * (each dev process starts from its own module seeds; nothing to heal).
 */
export async function ensureUc4SampleData(): Promise<void> {
  if (process.env.VITEST) return
  if (!isPrisma) return

  // Districts — 'Gampaha'/'Colombo' names may be taken by legacy rows; the
  // display name resolves from _types by id, so create-branch names are cosmetic.
  await prisma.district.upsert({ where: { id: KEGALLE }, update: {}, create: { id: KEGALLE, name: 'Kegalle' } })
  await prisma.district.upsert({ where: { id: GAMPAHA }, update: {}, create: { id: GAMPAHA, name: 'Gampaha (Sample)' } })
  await prisma.district.upsert({ where: { id: COLOMBO }, update: {}, create: { id: COLOMBO, name: 'Colombo' } })

  // Officers — generatedBy / actorId / attempt FKs.
  await prisma.officer.upsert({
    where: { id: SAMPLE_DMC },
    update: {},
    create: { id: SAMPLE_DMC, name: 'Sample DMC Official', role: 'DMC_OFFICIAL', phone: '0771000001', email: 'sample.dmc@dewecs.lk' },
  })
  await prisma.officer.upsert({
    where: { id: SAMPLE_DUTY },
    update: {},
    create: { id: SAMPLE_DUTY, name: 'Sample Duty Officer', role: 'DUTY_OFFICER', districtId: KEGALLE, phone: '0771000002' },
  })
  await prisma.officer.upsert({
    where: { id: SAMPLE_DISTRICT_OFFICER },
    update: {},
    create: { id: SAMPLE_DISTRICT_OFFICER, name: 'Sample District Officer', role: 'DISTRICT_OFFICER', districtId: KEGALLE, phone: '0771000003' },
  })

  // Partner organisations (exact UI PARTNER_ORGS ids).
  await prisma.organization.upsert({
    where: { id: ORG_ARMY },
    update: {},
    create: { id: ORG_ARMY, name: 'Sample Sri Lanka Army', type: 'ARMED_FORCES', coordinatorName: 'Army Coordinator' },
  })
  await prisma.organization.upsert({
    where: { id: ORG_WV },
    update: {},
    create: { id: ORG_WV, name: 'Sample World Vision Lanka', type: 'NGO', coordinatorName: 'NGO Coordinator', coordinatorEmail: 'ngo@example.lk' },
  })
  await prisma.organization.upsert({
    where: { id: ORG_DONOR },
    update: {},
    create: { id: ORG_DONOR, name: 'Sample Private Donor', type: 'PRIVATE_DONOR' },
  })

  // Citizens (1,000 Kegalle + 150 Gampaha + 100 Colombo) — skipDuplicates fills gaps.
  const citizenCount = await prisma.citizen.count({ where: { id: { in: CITIZEN_IDS } } })
  if (citizenCount < CITIZEN_IDS.length) {
    const rows = CITIZEN_IDS.map((id, i) => {
      const n = i + 1
      const districtId = n <= 1000 ? KEGALLE : n <= 1150 ? GAMPAHA : COLOMBO
      return { id, name: `Sample Citizen ${n}`, isVolunteer: false, districtId }
    })
    for (let i = 0; i < rows.length; i += 500) {
      await prisma.citizen.createMany({ data: rows.slice(i, i + 500), skipDuplicates: true })
    }
  }

  // Hazard alerts + target rows (6). Partial state (e.g. a district delete
  // removing target rows) wipes and rebuilds so targets stay consistent.
  const alertCount = await prisma.hazardAlert.count({ where: { message: { startsWith: ALERT_MARKER } } })
  const targetCount = await prisma.alertTargetDistrict.count({
    where: { alert: { message: { startsWith: ALERT_MARKER } } },
  })
  if (alertCount < 6 || targetCount < 6) {
    const oldAlerts = await prisma.hazardAlert.findMany({
      where: { message: { startsWith: ALERT_MARKER } },
      select: { id: true },
    })
    const oldIds = oldAlerts.map((a) => a.id)
    if (oldIds.length > 0) {
      await prisma.notificationAttempt.deleteMany({ where: { alertId: { in: oldIds } } })
      await prisma.alertTargetDistrict.deleteMany({ where: { alertId: { in: oldIds } } })
      await prisma.hazardAlert.deleteMany({ where: { id: { in: oldIds } } })
    }
    const alertSeeds = [
      { hazardType: 'FLOOD', severity: 'WARNING', status: 'ACTIVE', message: `${ALERT_MARKER}: flood warning for Kegalle district`, occurredAt: new Date('2026-08-15T10:00:00Z'), expiresAt: new Date('2026-08-20T10:00:00Z'), target: KEGALLE },
      { hazardType: 'LANDSLIDE', severity: 'WATCH', status: 'ESCALATED', message: `${ALERT_MARKER}: landslide watch for Kegalle district`, occurredAt: new Date('2026-08-20T14:00:00Z'), expiresAt: null, target: KEGALLE },
      { hazardType: 'CYCLONE', severity: 'EMERGENCY', status: 'ACTIVE', message: `${ALERT_MARKER}: cyclone emergency for Colombo district`, occurredAt: new Date('2026-08-27T06:00:00Z'), expiresAt: null, target: COLOMBO },
      { hazardType: 'DROUGHT', severity: 'ADVISORY', status: 'ACTIVE', message: `${ALERT_MARKER}: drought advisory for Gampaha district`, occurredAt: new Date('2026-09-04T09:00:00Z'), expiresAt: null, target: GAMPAHA },
      { hazardType: 'FLOOD', severity: 'WATCH', status: 'ACTIVE', message: `${ALERT_MARKER}: flood watch for Gampaha district`, occurredAt: new Date('2026-09-11T08:00:00Z'), expiresAt: null, target: GAMPAHA },
      { hazardType: 'CYCLONE', severity: 'WARNING', status: 'ACTIVE', message: `${ALERT_MARKER}: cyclone warning for Colombo district`, occurredAt: new Date('2026-09-10T07:00:00Z'), expiresAt: null, target: COLOMBO },
    ]
    for (const seed of alertSeeds) {
      await prisma.hazardAlert.create({
        data: {
          hazardType: seed.hazardType as Prisma.HazardAlertCreateManyInput['hazardType'],
          severity: seed.severity as Prisma.HazardAlertCreateManyInput['severity'],
          status: seed.status as Prisma.HazardAlertCreateManyInput['status'],
          message: seed.message,
          issuedById: SAMPLE_DMC,
          occurredAt: seed.occurredAt,
          expiresAt: seed.expiresAt,
          targetDistricts: { create: [{ districtId: seed.target }] },
        },
      })
    }
  }

  // Notification attempts (2,400) — only when the marker alerts have none.
  const alertRows = await prisma.hazardAlert.findMany({
    where: { message: { startsWith: ALERT_MARKER } },
    select: { id: true, message: true },
  })
  const alertIdByMessage = new Map(alertRows.map((a) => [a.message, a.id]))
  const attemptCount = await prisma.notificationAttempt.count({
    where: { alertId: { in: alertRows.map((a) => a.id) } },
  })
  if (alertRows.length === 6 && attemptCount < 2400) {
    // Wipe partial attempt sets first — (alert, citizen, channel) has no unique
    // constraint, so reseeding over leftovers would double-count reach.
    await prisma.notificationAttempt.deleteMany({ where: { alertId: { in: alertRows.map((a) => a.id) } } })
    const attempts: Prisma.NotificationAttemptCreateManyInput[] = []
    const alert1 = alertIdByMessage.get(`${ALERT_MARKER}: flood warning for Kegalle district`)!
    const alert5 = alertIdByMessage.get(`${ALERT_MARKER}: flood watch for Gampaha district`)!
    const alert6 = alertIdByMessage.get(`${ALERT_MARKER}: cyclone warning for Colombo district`)!

    const kegalleTime = new Date('2026-08-15T10:05:00Z')
    for (let i = 1; i <= 1000; i++) {
      const pushDelivered = i <= 950
      const smsDelivered = i <= 850 || i > 950
      attempts.push(
        {
          alertId: alert1, citizenId: citizenId(i), districtId: KEGALLE, hazardType: 'FLOOD',
          channel: 'PUSH', status: pushDelivered ? 'DELIVERED' : 'FAILED', kind: 'ISSUE',
          occurredAt: kegalleTime, sentAt: kegalleTime, deliveredAt: pushDelivered ? kegalleTime : null,
          failureReason: pushDelivered ? null : 'Device unreachable',
        },
        {
          alertId: alert1, citizenId: citizenId(i), districtId: KEGALLE, hazardType: 'FLOOD',
          channel: 'SMS', status: smsDelivered ? 'DELIVERED' : 'FAILED', kind: 'ISSUE',
          occurredAt: kegalleTime, sentAt: kegalleTime, deliveredAt: smsDelivered ? kegalleTime : null,
          failureReason: smsDelivered ? null : 'Handset unavailable',
        },
      )
    }
    const gampahaTime = new Date('2026-09-11T08:30:00Z')
    for (let i = 1001; i <= 1150; i++) {
      attempts.push({
        alertId: alert5, citizenId: citizenId(i), districtId: GAMPAHA, hazardType: 'FLOOD',
        channel: 'PUSH', status: 'DELIVERED', kind: 'ISSUE',
        occurredAt: gampahaTime, sentAt: gampahaTime, deliveredAt: gampahaTime, failureReason: null,
      })
      if (i <= 1050) {
        attempts.push({
          alertId: alert5, citizenId: citizenId(i), districtId: GAMPAHA, hazardType: 'FLOOD',
          channel: 'SMS', status: 'DELIVERED', kind: 'ISSUE',
          occurredAt: gampahaTime, sentAt: gampahaTime, deliveredAt: gampahaTime, failureReason: null,
        })
      }
    }
    const colomboTime = new Date('2026-09-15T08:30:00Z')
    for (let i = 1151; i <= 1250; i++) {
      const smsDelivered = i <= 1240
      attempts.push(
        {
          alertId: alert6, citizenId: citizenId(i), districtId: COLOMBO, hazardType: 'CYCLONE',
          channel: 'PUSH', status: 'DELIVERED', kind: 'ISSUE',
          occurredAt: colomboTime, sentAt: colomboTime, deliveredAt: colomboTime, failureReason: null,
        },
        {
          alertId: alert6, citizenId: citizenId(i), districtId: COLOMBO, hazardType: 'CYCLONE',
          channel: 'SMS', status: smsDelivered ? 'DELIVERED' : 'FAILED', kind: 'ISSUE',
          occurredAt: colomboTime, sentAt: colomboTime, deliveredAt: smsDelivered ? colomboTime : null,
          failureReason: smsDelivered ? null : 'Network busy',
        },
      )
    }
    for (let i = 0; i < attempts.length; i += 500) {
      await prisma.notificationAttempt.createMany({ data: attempts.slice(i, i + 500) })
    }
  }

  // Ground reports + audit entries (51 → 42 verified / 6 pending / 3 rejected).
  const reportCount = await prisma.groundReport.count({ where: { localId: { startsWith: REPORT_MARKER } } })
  if (reportCount < 51) {
    await prisma.reportAuditEntry.deleteMany({ where: { report: { localId: { startsWith: REPORT_MARKER } } } })
    await prisma.groundReport.deleteMany({ where: { localId: { startsWith: REPORT_MARKER } } })
    for (let i = 1; i <= 51; i++) {
      const localId = `${REPORT_MARKER}${i.toString().padStart(3, '0')}`
      const day = ((i % 28) + 1).toString().padStart(2, '0')
      const captureTime = new Date(`2026-08-${day}T10:00:00Z`)
      const hazardType = i % 4 === 0 ? 'LANDSLIDE' : 'FLOOD'

      let reviewStatus: 'VERIFIED' | 'REJECTED' | 'NEEDS_INFO' | 'PENDING_REVIEW'
      let action: 'VERIFIED' | 'REJECTED' | 'NEEDS_INFO' | 'CLARIFIED'
      let reason: string | null
      if (i <= 42) {
        reviewStatus = 'VERIFIED'
        action = 'VERIFIED'
        reason = null
      } else if (i <= 45) {
        reviewStatus = 'REJECTED'
        action = 'REJECTED'
        reason = 'Insufficient evidence'
      } else if (i <= 48) {
        reviewStatus = 'NEEDS_INFO'
        action = 'NEEDS_INFO'
        reason = 'Awaiting photo evidence'
      } else {
        reviewStatus = 'PENDING_REVIEW'
        action = 'CLARIFIED'
        reason = 'Citizen supplied additional details'
      }

      const report = await prisma.groundReport.create({
        data: {
          localId,
          reporterId: citizenId((i % 20) + 1),
          districtId: KEGALLE,
          hazardType,
          description: `Sample UC4 ground report #${i} - observed hazard`,
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
      await prisma.reportAuditEntry.create({
        data: {
          reportId: report.id,
          action,
          officerId: SAMPLE_DUTY,
          reason,
          occurredAt: new Date(captureTime.getTime() + 3600_000),
          districtId: KEGALLE,
          hazardType,
        },
      })
    }
  }

  // Shelters (upsert, existing occupancy untouched) + 5 occupancy events.
  const shelterSeeds = [
    { id: SHELTER_IDS[0], name: 'Sample UC4 Shelter Kegalle 1', districtId: KEGALLE, capacity: 500, occupancy: 420 },
    { id: SHELTER_IDS[1], name: 'Sample UC4 Shelter Kegalle 2', districtId: KEGALLE, capacity: 500, occupancy: 80 },
    { id: SHELTER_IDS[2], name: 'Sample UC4 Shelter Colombo 1', districtId: COLOMBO, capacity: 400, occupancy: 55 },
    { id: SHELTER_IDS[3], name: 'Sample UC4 Shelter Colombo 2', districtId: COLOMBO, capacity: 400, occupancy: 35 },
    { id: SHELTER_IDS[4], name: 'Sample UC4 Shelter Gampaha 1', districtId: GAMPAHA, capacity: 300, occupancy: 20 },
  ]
  for (const shelter of shelterSeeds) {
    await prisma.shelter.upsert({
      where: { id: shelter.id },
      update: {},
      create: {
        id: shelter.id,
        name: shelter.name,
        address: `Sample Address, ${shelter.name}`,
        capacity: shelter.capacity,
        occupancy: shelter.occupancy,
        status: 'OPEN',
        version: 1,
        districtId: shelter.districtId,
        organizationId: ORG_WV,
      },
    })
  }
  const occupancyCount = await prisma.occupancyEvent.count({ where: { shelterId: { in: SHELTER_IDS } } })
  if (occupancyCount < 5) {
    await prisma.occupancyEvent.deleteMany({ where: { shelterId: { in: SHELTER_IDS } } })
    await prisma.occupancyEvent.createMany({
      data: [
        { shelterId: SHELTER_IDS[0], districtId: KEGALLE, previousCount: 0, newCount: 420, actorId: SAMPLE_DUTY, occurredAt: new Date('2026-08-16T10:00:00Z'), actionId: 'sample-occupancy-k1' },
        { shelterId: SHELTER_IDS[1], districtId: KEGALLE, previousCount: 0, newCount: 80, actorId: SAMPLE_DUTY, occurredAt: new Date('2026-08-17T10:00:00Z'), actionId: 'sample-occupancy-k2' },
        { shelterId: SHELTER_IDS[2], districtId: COLOMBO, previousCount: 0, newCount: 55, actorId: SAMPLE_DUTY, occurredAt: new Date('2026-08-25T10:00:00Z'), actionId: 'sample-occupancy-c1' },
        { shelterId: SHELTER_IDS[3], districtId: COLOMBO, previousCount: 0, newCount: 35, actorId: SAMPLE_DUTY, occurredAt: new Date('2026-08-26T10:00:00Z'), actionId: 'sample-occupancy-c2' },
        { shelterId: SHELTER_IDS[4], districtId: GAMPAHA, previousCount: 0, newCount: 20, actorId: SAMPLE_DUTY, occurredAt: new Date('2026-08-28T10:00:00Z'), actionId: 'sample-occupancy-g1' },
      ],
    })
  }

  // Supply stocks + distributions (50 / 100 / 80 / 70 %).
  const stockCount = await prisma.supplyStock.count({
    where: { organizationId: { in: [ORG_ARMY, ORG_WV, ORG_DONOR] } },
  })
  if (stockCount < 4) {
    await prisma.distribution.deleteMany({ where: { actionId: { startsWith: ACTION_MARKER } } })
    await prisma.supplyStock.deleteMany({ where: { organizationId: { in: [ORG_ARMY, ORG_WV, ORG_DONOR] } } })
    const stockData = [
      { supplyType: 'FOOD', onHand: 10000 },
      { supplyType: 'WATER', onHand: 5500 },
      { supplyType: 'MEDICINE', onHand: 800 },
      { supplyType: 'SHELTER_MATERIAL', onHand: 300 },
    ]
    const stockIds: Record<string, string> = {}
    for (const stock of stockData) {
      const row = await prisma.supplyStock.create({
        data: { organizationId: ORG_WV, districtId: KEGALLE, supplyType: stock.supplyType, onHand: stock.onHand },
      })
      stockIds[stock.supplyType] = row.id
    }
    await prisma.distribution.createMany({
      data: [
        { stockId: stockIds.FOOD, destinationShelterId: SHELTER_IDS[0], organizationId: ORG_WV, districtId: KEGALLE, quantity: 3000, actorId: SAMPLE_DISTRICT_OFFICER, occurredAt: new Date('2026-08-16T11:00:00Z'), actionId: `${ACTION_MARKER}food-1` },
        { stockId: stockIds.FOOD, destinationShelterId: SHELTER_IDS[1], organizationId: ORG_WV, districtId: KEGALLE, quantity: 2000, actorId: SAMPLE_DISTRICT_OFFICER, occurredAt: new Date('2026-08-17T11:00:00Z'), actionId: `${ACTION_MARKER}food-2` },
        { stockId: stockIds.WATER, destinationShelterId: SHELTER_IDS[0], organizationId: ORG_WV, districtId: KEGALLE, quantity: 5500, actorId: SAMPLE_DISTRICT_OFFICER, occurredAt: new Date('2026-08-16T12:00:00Z'), actionId: `${ACTION_MARKER}water-1` },
        { stockId: stockIds.MEDICINE, destinationShelterId: SHELTER_IDS[1], organizationId: ORG_WV, districtId: KEGALLE, quantity: 640, actorId: SAMPLE_DISTRICT_OFFICER, occurredAt: new Date('2026-08-17T12:00:00Z'), actionId: `${ACTION_MARKER}med-1` },
        { stockId: stockIds.SHELTER_MATERIAL, destinationShelterId: SHELTER_IDS[0], organizationId: ORG_WV, districtId: KEGALLE, quantity: 210, actorId: SAMPLE_DISTRICT_OFFICER, occurredAt: new Date('2026-08-18T11:00:00Z'), actionId: `${ACTION_MARKER}shelter-1` },
      ],
    })
  }
}

// ─── Route wiring (auto-seed + on-read hydration, never under test) ──────────

/** True only in a live app process — never under Vitest or a test build. */
export function isLiveRoute(): boolean {
  return !process.env.VITEST && process.env.NODE_ENV !== 'test'
}

/** Best-effort source-data guard for API routes (count-gated, never throws). */
export async function ensureForRoute(): Promise<void> {
  if (!isLiveRoute()) return
  try {
    await ensureUc4SampleData()
  } catch (error) {
    console.warn('[uc4] ensure sample data failed:', error)
  }
}
