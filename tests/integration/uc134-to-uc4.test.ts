import { describe, expect, it } from 'vitest'

import type { Actor, HazardAlert, NotificationAttempt, ReportDecision, OccupancyEvent, Distribution } from '@/shared/contracts/types'

import { FakeClock, SequentialIdGenerator } from '@/shared/infra/fakes'
import { InMemoryShareLogRepository } from '@/shared/infra/InMemoryShareLogRepository'
import { InMemorySnapshotRepository } from '@/shared/infra/InMemorySnapshotRepository'

import type { AuditLogger } from '@/modules/uc4-analysis/adapters/AuditLogger'
import { MockPartnerChannel } from '@/modules/uc4-analysis/adapters/MockPartnerChannel'
import type { Organization, OrganizationReader, PartnerChannel } from '@/modules/uc4-analysis/adapters/PartnerChannel'
import type { AnalysisReport } from '@/modules/uc4-analysis/domain/AnalysisReport'
import { ForbiddenError } from '@/modules/uc4-analysis/domain/errors'
import type { Metrics } from '@/modules/uc4-analysis/domain/Metrics'
import { AggregationService } from '@/modules/uc4-analysis/services/AggregationService'
import { ReachCalculator } from '@/modules/uc4-analysis/services/ReachCalculator'
import { ReportFilterValidator } from '@/modules/uc4-analysis/services/ReportFilterValidator'
import { ShareService } from '@/modules/uc4-analysis/services/ShareService'
import { SnapshotService } from '@/modules/uc4-analysis/services/SnapshotService'

// ─── Inline fake readers — no UC1/UC2/UC3 imports ──────────────────────────────

class InlineAlertReader {
  constructor(private readonly data: HazardAlert[]) {}
  async listAlerts(_filter: unknown): Promise<HazardAlert[]> {
    return this.data
  }
}

class InlineAttemptReader {
  constructor(private readonly data: NotificationAttempt[]) {}
  async listAttempts(_filter: unknown): Promise<NotificationAttempt[]> {
    return this.data
  }
}

class InlineDecisionReader {
  constructor(private readonly data: ReportDecision[]) {}
  async listDecisions(_filter: unknown): Promise<ReportDecision[]> {
    return this.data
  }
}

class InlineOccupancyReader {
  constructor(private readonly data: OccupancyEvent[]) {}
  async listEvents(_filter: unknown): Promise<OccupancyEvent[]> {
    return this.data
  }
}

class InlineDistributionReader {
  constructor(private readonly data: Distribution[]) {}
  async listDistributions(_filter: unknown): Promise<Distribution[]> {
    return this.data
  }
}

// ─── Deterministic RNG for MockPartnerChannel ──────────────────────────────────

class ScriptedRng {
  constructor(private values: number[]) {}
  next(): number {
    return this.values.shift() ?? 0
  }
}

// ─── Test doubles ──────────────────────────────────────────────────────────────

class FakeOrganizationReader implements OrganizationReader {
  constructor(private readonly orgs: Organization[]) {}
  getById(id: string): Organization | null {
    return this.orgs.find((o) => o.id === id) ?? null
  }
}

class FakeAuditLogger implements AuditLogger {
  readonly generations: Array<{ reportId: string; actorId: string }> = []
  readonly failures: Array<{ reason: string; actorId: string }> = []
  readonly shares: Array<{ reportId: string; actorId: string }> = []

  logGeneration(reportId: string, actorId: string): void {
    this.generations.push({ reportId, actorId })
  }
  logFailure(reason: string, actorId: string): void {
    this.failures.push({ reason, actorId })
  }
  logShare(reportId: string, _outcomes: unknown[], actorId: string): void {
    this.shares.push({ reportId, actorId })
  }
}

// ─── Seed data ─────────────────────────────────────────────────────────────────

const districtId = '3f1d3e0a-8f5e-4a2b-9c7d-1e2f3a4b5c6d'
const shelterId1 = 'shelter-001'
const shelterId2 = 'shelter-002'

// 3 alerts (FLOOD, Aug 2026, Kegalle)
const alerts: HazardAlert[] = [
  {
    id: 'alert-001',
    hazardType: 'FLOOD',
    severity: 'WARNING',
    districtId,
    occurredAt: new Date('2026-08-01T06:00:00.000Z'),
  },
  {
    id: 'alert-002',
    hazardType: 'FLOOD',
    severity: 'EMERGENCY',
    districtId,
    occurredAt: new Date('2026-08-10T06:00:00.000Z'),
  },
  {
    id: 'alert-003',
    hazardType: 'FLOOD',
    severity: 'ADVISORY',
    districtId,
    occurredAt: new Date('2026-08-20T06:00:00.000Z'),
  },
]

// 1000 citizens × 2 channels (SMS + PUSH), mixed delivery: 900 delivered, 100 failed
function buildAttempts(): NotificationAttempt[] {
  // Ensure exactly 1000 distinct citizens reached (BR3).
  // 900 citizens: BOTH channels DELIVERED
  // 100 citizens: only PUSH DELIVERED, SMS FAILED
  const attempts: NotificationAttempt[] = []
  for (let i = 1; i <= 1000; i++) {
    const citizenId = `citizen-${String(i).padStart(4, '0')}`
    const occurredAt = new Date('2026-08-01T06:00:00.000Z')
    const attemptAt = new Date('2026-08-01T06:01:00.000Z')

    // SMS — delivered for first 900, failed for last 100
    attempts.push({
      id: `attempt-sms-${i}`,
      alertId: 'alert-001',
      citizenId,
      districtId,
      hazardType: 'FLOOD',
      channel: 'SMS',
      deliveryStatus: i <= 900 ? 'DELIVERED' : 'FAILED',
      occurredAt,
      attemptAt,
    })
    // PUSH — delivered for ALL 1000
    attempts.push({
      id: `attempt-push-${i}`,
      alertId: 'alert-001',
      citizenId,
      districtId,
      hazardType: 'FLOOD',
      channel: 'PUSH',
      deliveryStatus: 'DELIVERED',
      occurredAt,
      attemptAt,
    })
  }
  return attempts
}

// 42 VERIFIED + 6 PENDING + 3 REJECTED decisions
function buildDecisions(): ReportDecision[] {
  const decisions: ReportDecision[] = []
  for (let i = 1; i <= 42; i++) {
    decisions.push({
      id: `decision-verify-${i}`,
      reportId: `report-${i}`,
      districtId,
      hazardType: 'FLOOD',
      reviewStatus: 'VERIFIED',
      occurredAt: new Date('2026-08-01T00:00:00.000Z'),
      officerId: 'officer-1',
    })
  }
  for (let i = 1; i <= 6; i++) {
    decisions.push({
      id: `decision-pending-${i}`,
      reportId: `report-p-${i}`,
      districtId,
      hazardType: 'FLOOD',
      reviewStatus: 'PENDING_REVIEW',
      occurredAt: new Date('2026-08-01T00:00:00.000Z'),
    })
  }
  for (let i = 1; i <= 3; i++) {
    decisions.push({
      id: `decision-reject-${i}`,
      reportId: `report-r-${i}`,
      districtId,
      hazardType: 'FLOOD',
      reviewStatus: 'REJECTED',
      occurredAt: new Date('2026-08-01T00:00:00.000Z'),
      reason: 'Insufficient evidence',
    })
  }
  return decisions
}

// 2 shelters with dated OccupancyEvents
const occupancyEvents: OccupancyEvent[] = [
  {
    id: 'occ-001',
    shelterId: shelterId1,
    districtId,
    previousCount: 0,
    newCount: 250,
    occurredAt: new Date('2026-08-02T10:00:00.000Z'),
  },
  {
    id: 'occ-002',
    shelterId: shelterId2,
    districtId,
    previousCount: 0,
    newCount: 180,
    occurredAt: new Date('2026-08-02T11:00:00.000Z'),
  },
  {
    id: 'occ-003',
    shelterId: shelterId1,
    districtId,
    previousCount: 250,
    newCount: 320,
    occurredAt: new Date('2026-08-05T10:00:00.000Z'),
  },
]

// 2 Distribution records (food, water)
const distributions: Distribution[] = [
  {
    id: 'dist-food-001',
    supplyType: 'FOOD',
    districtId,
    distributed: 5000,
    total: 6000,
    occurredAt: new Date('2026-08-03T09:00:00.000Z'),
  },
  {
    id: 'dist-water-001',
    supplyType: 'WATER',
    districtId,
    distributed: 3000,
    total: 3000,
    occurredAt: new Date('2026-08-04T09:00:00.000Z'),
  },
]

// ─── Helpers ───────────────────────────────────────────────────────────────────

const dmcOfficial: Actor = { id: 'officer-001', role: 'DMC_OFFICIAL' }

const baseInput = {
  from: '2026-08-01',
  to: '2026-08-31',
  districtId,
  hazardType: 'FLOOD' as const,
  includedSections: ['ALERTS', 'REACH', 'REPORTS', 'SHELTERS', 'SUPPLIES'] as const,
  language: 'EN' as const,
}

function buildUc4Module() {
  const snapshotRepo = new InMemorySnapshotRepository()
  const shareLogRepo = new InMemoryShareLogRepository()
  const audit = new FakeAuditLogger()
  const clock = new FakeClock(new Date('2026-09-01T00:00:00.000Z'))
  const idGenerator = new SequentialIdGenerator('rep')

  const alertReader = new InlineAlertReader(alerts)
  const attemptReader = new InlineAttemptReader(buildAttempts())
  const decisionReader = new InlineDecisionReader(buildDecisions())
  const occupancyReader = new InlineOccupancyReader(occupancyEvents)
  const distributionReader = new InlineDistributionReader(distributions)

  const supplyStockReader = {
    listStocks: async () => [
      { id: 'stock-food', organizationId: 'org-1', districtId, supplyType: 'FOOD', onHand: 6000, updatedAt: new Date('2026-08-01T00:00:00.000Z') },
      { id: 'stock-water', organizationId: 'org-1', districtId, supplyType: 'WATER', onHand: 3000, updatedAt: new Date('2026-08-01T00:00:00.000Z') },
    ],
  }

  const aggregation = new AggregationService(
    alertReader,
    attemptReader,
    decisionReader,
    occupancyReader,
    distributionReader,
    supplyStockReader,
    new ReachCalculator(),
  )

  const snapshotService = new SnapshotService(
    new ReportFilterValidator(),
    aggregation,
    snapshotRepo,
    audit,
    clock,
    idGenerator,
  )

  const shareService = new ShareService(
    snapshotRepo,
    shareLogRepo,
    new MockPartnerChannel(new ScriptedRng([]), 0),
    new FakeOrganizationReader([]),
    audit,
    clock,
    idGenerator,
  )

  return {
    snapshotService,
    shareService,
    snapshotRepo,
    shareLogRepo,
    audit,
    clock,
    idGenerator,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════

describe('UC4 integration: UC1+UC3 → UC4 full flow', () => {
  it('INT-01: full flow produces correct metrics', async () => {
    const { snapshotService, snapshotRepo } = buildUc4Module()

    const report = await snapshotService.generate(baseInput, dmcOfficial)

    // ── Alerts ──
    expect(report.metrics.alerts.total).toBe(3)
    expect(report.metrics.alerts.bySeverity).toEqual({
      WARNING: 1,
      EMERGENCY: 1,
      ADVISORY: 1,
    })
    expect(report.metrics.alerts.byHazardType).toEqual({ FLOOD: 3 })

    // ── Reach ──
    // 1000 distinct citizens reached (NOT 2000 — per-channel counts are non-additive)
    expect(report.metrics.reach.distinctCitizens).toBe(1000)

    // Per-channel: 1000 attempted each
    // SMS: 900 delivered (citizens 1-900), 100 failed (citizens 901-1000)
    // PUSH: 1000 delivered (all citizens), 0 failed
    expect(report.metrics.reach.perChannel.SMS).toEqual({
      attempted: 1000,
      delivered: 900,
      failed: 100,
    })
    expect(report.metrics.reach.perChannel.PUSH).toEqual({
      attempted: 1000,
      delivered: 1000,
      failed: 0,
    })

    // ── Reports ──
    expect(report.metrics.reports.verified).toBe(42)
    expect(report.metrics.reports.rejected).toBe(3)
    expect(report.metrics.reports.pending).toBe(6)

    // ── Shelters ──
    expect(report.metrics.shelters.activated).toBe(2)
    expect(report.metrics.shelters.peakOccupancy).toBe(320)
    expect(report.metrics.shelters.events).toHaveLength(3)

    // ── Supplies ──
    expect(report.metrics.supplies.byType.FOOD).toEqual({
      distributed: 5000,
      total: 6000,
      percent: 83, // Math.round(5000/6000*100)
    })
    expect(report.metrics.supplies.byType.WATER).toEqual({
      distributed: 3000,
      total: 3000,
      percent: 100,
    })

    // ── Saved & retrievable ──
    expect(snapshotRepo.count()).toBe(1)
    const refetched = await snapshotRepo.getById(report.id)
    expect(refetched).not.toBeNull()
    expect(refetched?.id).toBe(report.id)
    expect(refetched?.metrics.alerts.total).toBe(3)
    expect(refetched?.metrics.reach.distinctCitizens).toBe(1000)
  })})

// ═══════════════════════════════════════════════════════════════════════════════
// Corrected INT-02 with proper retry semantics
// ═══════════════════════════════════════════════════════════════════════════════

describe('UC4 integration: share retry semantics', () => {
  it('INT-02: share failures append without invalidating snapshot', async () => {
    const {
      snapshotService,
      snapshotRepo,
      shareLogRepo,
      clock,
    } = buildUc4Module()

    // Generate the report first.
    const report = await snapshotService.generate(baseInput, dmcOfficial)
    const reportId = report.id

    const organizations: Organization[] = [
      { id: 'org-1', name: 'World Vision Lanka', type: 'NGO' },
      { id: 'org-2', name: 'Red Cross Ceylon', type: 'NGO' },
      { id: 'org-3', name: 'Private Donor Consortium', type: 'PRIVATE_DONOR' },
    ]

    // ── First batch: deterministic RNG → SENT, FAILED, SENT ──
    // At 0.5 failure rate: 0.9 >= 0.5 → SENT, 0.1 < 0.5 → FAILED, 0.9 >= 0.5 → SENT
    const rng1 = new ScriptedRng([0.9, 0.1, 0.9])
    const channel1 = new MockPartnerChannel(rng1, 0.5) as PartnerChannel

    const shareService1 = new ShareService(
      snapshotRepo,
      shareLogRepo,
      channel1,
      new FakeOrganizationReader(organizations),
      new FakeAuditLogger(),
      clock,
      new SequentialIdGenerator('sh1'),
    )

    const firstOutcomes = await shareService1.share(reportId, ['org-1', 'org-2', 'org-3'], dmcOfficial)

    expect(firstOutcomes.map((o) => o.status)).toEqual(['SENT', 'FAILED', 'SENT'])
    // 3 share log entries from the first batch
    expect(shareLogRepo.count()).toBe(3)

    // Snapshot still retrievable via repo.getById after share attempts
    const refetched = await snapshotRepo.getById(reportId)
    expect(refetched).not.toBeNull()
    expect(refetched?.metrics.alerts.total).toBe(3)
    expect(refetched?.metrics.reach.distinctCitizens).toBe(1000)

    // ── Retry: only re-share the failed org (org-2) ──
    // Deterministic RNG → success this time
    const rng2 = new ScriptedRng([0.9]) // 0.9 >= 0.5 → SENT
    const channel2 = new MockPartnerChannel(rng2, 0.5) as PartnerChannel

    const shareService2 = new ShareService(
      snapshotRepo,
      shareLogRepo,
      channel2,
      new FakeOrganizationReader(organizations),
      new FakeAuditLogger(),
      clock,
      new SequentialIdGenerator('sh2'),
    )

    const retryOutcomes = await shareService2.share(reportId, ['org-2'], dmcOfficial)

    expect(retryOutcomes.map((o) => o.status)).toEqual(['SENT'])
    // Retry appends: 3 + 1 = 4
    expect(shareLogRepo.count()).toBe(4)

    // Snapshot STILL retrievable — unchanged
    const refetched2 = await snapshotRepo.getById(reportId)
    expect(refetched2).not.toBeNull()
    expect(refetched2?.metrics.alerts.total).toBe(3)
    expect(refetched2?.metrics.reach.distinctCitizens).toBe(1000)

    // Verify all 4 share log rows exist for this report
    const allShares = await shareLogRepo.listByReport(reportId)
    expect(allShares).toHaveLength(4)
    expect(allShares.map((s) => s.status)).toEqual(['SENT', 'FAILED', 'SENT', 'SENT'])
  })
})
