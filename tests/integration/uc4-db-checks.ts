import type { ExpectStatic } from 'vitest'

import { getActor, requireRole } from '@/shared/access'
import { MockPartnerChannel } from '@/modules/uc4-analysis/adapters/MockPartnerChannel'
import { PrismaSnapshotRepository } from '@/modules/uc4-analysis/adapters/prisma/PrismaSnapshotRepository'
import type { SnapshotRepository } from '@/modules/uc4-analysis/adapters/SnapshotRepository'
import type { AnalysisReport } from '@/modules/uc4-analysis/domain/AnalysisReport'
import {
  AggregationTimeoutError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/modules/uc4-analysis/domain/errors'
import { PdfExporter } from '@/modules/uc4-analysis/services/PdfExporter'
import { ReachCalculator } from '@/modules/uc4-analysis/services/ReachCalculator'
import type { Actor, Filter, HazardType, NotificationAttempt, Role } from '@/shared/contracts/types'
import { prisma } from '@/shared/infra/prisma/client'

import {
  CLOCK_MODE,
  DEADLINE,
  FIXED_NOW,
  PrismaAttemptReader,
  RecordingReaders,
  SEED_SPEC,
  ScriptedRng,
  WINDOW,
  countOurRows,
  dbReaders,
  dmcActor,
  expiredClock,
  extractPdfText,
  filterInput,
  makeAggregation,
  makeShareService,
  makeSnapshotService,
  neverReaders,
  saveSnapshot,
  validatedFilters,
} from './uc4-db-fixtures'
import type { SeedData } from './uc4-db-fixtures'

export type SectionKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J'

export interface CheckContext {
  seed: SeedData
  expect: ExpectStatic
  log: (line: string) => void
  reports: string[]
}

export interface Check {
  id: string
  section: SectionKey
  title: string
  run: (ctx: CheckContext) => Promise<void>
}

export interface SectionSummary {
  key: SectionKey
  title: string
  total: number
  pass: number
  fail: number
  skip: number
}

export const SECTIONS: ReadonlyArray<{ key: SectionKey; title: string }> = [
  { key: 'A', title: 'A. DB connection & schema' },
  { key: 'B', title: 'B. ReachCalculator vs DB (A02, BR3, BR4)' },
  { key: 'C', title: 'C. AggregationService vs DB (A03, A06, A08)' },
  { key: 'D', title: 'D. SnapshotService vs DB (A03c, A04-A06, A09)' },
  { key: 'E', title: 'E. PdfExporter from DB snapshots (A11, BR12)' },
  { key: 'F', title: 'F. ShareService vs DB (A07, BR8, BR9)' },
  { key: 'G', title: 'G. Business rules BR1-BR12' },
  { key: 'H', title: 'H. Role enforcement (ROLE-01/02/03)' },
  { key: 'I', title: 'I. API routes (in-process)' },
  { key: 'J', title: 'J. Persistence & raw SQL checks' },
]

export const FINDINGS: readonly string[] = [
  `Clock: the spec example 2026-09-01 is in the past, so the suite uses FIXED_NOW = ${FIXED_NOW.toISOString()} (mode: ${CLOCK_MODE}); expired-clock tests use ${'2020-01-01T00:00:00.000Z'}.`,
  'BR1 / ROLE-01..03: role checks live only in the API layer (getActor + requireRole); SnapshotService and ShareService accept any Actor without checking its role.',
  'Container (src/shared/infra/container.ts) wires EMPTY UC1/UC3 readers, so API-generated reports always carry alerts/reach/shelters/supplies = 0 while reports come from the real UC2 decision reader (42/3/6) — warningFlag stays false.',
  'Container organizationReader returns null for every id, so API share outcomes are all FAILED with organizationName "?" even for organisations that exist in the DB (rows are still appended).',
  'ShareService promises "unknown recipient -> FAILED outcome", but report_share.organization_id has a NOT NULL FK to organization.id: under Prisma the save throws (API 500) instead of logging FAILED. Not asserted as expected behaviour.',
  'BR10 denominator: AggregationService sums supply_stock.on_hand once PER distribution row, so FOOD with two distributions = 5000/20000 = 25 % instead of 50 %; single-distribution types (WATER) are unaffected.',
  'BR12: includedSections gates PDF rendering only — metrics always compute every section (asserted in G.BR12).',
  'Supplies denominators read supply_stock.on_hand at aggregation time (stock level), not remaining stock per event.',
  'DecisionQueryService maps UC2 action CLARIFIED -> PENDING_REVIEW; the seed produces the pending tally through NEEDS_INFO rows.',
  'Route-level 403/400/404 mappings are exercised in Section I rather than in H, because BR1 is documented as enforced by API requireRole.',
]

const EXPECTED_ALERTS = {
  total: 3,
  bySeverity: { WARNING: 3 },
  byHazardType: { FLOOD: 3 },
}

const EXPECTED_REACH = {
  distinctCitizens: 1000,
  perChannel: {
    PUSH: { attempted: 1000, delivered: 950, failed: 50 },
    SMS: { attempted: 1000, delivered: 900, failed: 100 },
  },
}

const EXPECTED_REPORTS = { verified: 42, rejected: 3, pending: 6 }

const EXPECTED_SUPPLIES = {
  FOOD: { distributed: 5000, total: 10000, percent: 50 },
  WATER: { distributed: 5000, total: 10000, percent: 50 },
  MEDICINE: { distributed: 100, total: 0, percent: null },
}

const state = {
  fullReportId: '',
  warningReportId: '',
  routeReportId: '',
}

const API = 'http://localhost/api/analysis'

function must<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) {
    throw new Error(message)
  }
  return value
}

function sharedFilter(seed: SeedData): Filter {
  const filters = validatedFilters(seed)
  return {
    from: filters.from,
    to: filters.to,
    districtId: filters.districtId,
    hazardType: filters.hazardType,
  }
}

function jsonCookie(role: Role, id: string): string {
  return `actor=${encodeURIComponent(JSON.stringify({ id, role }))}`
}

function bareCookie(role: Role): string {
  return `actor=${role}`
}

class CountingRepository implements SnapshotRepository {
  saves = 0
  private readonly inner: SnapshotRepository

  constructor(inner: SnapshotRepository) {
    this.inner = inner
  }

  save(report: AnalysisReport): Promise<void> {
    this.saves += 1
    return this.inner.save(report)
  }

  getById(id: string): Promise<AnalysisReport | null> {
    return this.inner.getById(id)
  }

  list(query?: { limit?: number; districtId?: string; hazardType?: HazardType }): Promise<AnalysisReport[]> {
    return this.inner.list(query)
  }
}

const checksA: Check[] = [
  {
    id: 'A.1',
    section: 'A',
    title: 'prisma.$connect() succeeds and all 15 UC tables exist',
    async run({ expect }) {
      await prisma.$connect()
      const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) AS count FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name IN (
          'analysis_report', 'report_share', 'officer', 'organization', 'district',
          'citizen', 'hazard_alert', 'alert_target_district', 'notification_attempt',
          'ground_report', 'report_audit_entry', 'shelter', 'supply_stock',
          'occupancy_event', 'distribution'
        )`
      expect(Number(rows[0].count)).toBe(15)
    },
  },
  {
    id: 'A.2',
    section: 'A',
    title: 'analysis_report / report_share counts are numbers >= 0',
    async run({ expect }) {
      const reports = await prisma.analysisReport.count()
      const shares = await prisma.reportShare.count()
      expect(typeof reports).toBe('number')
      expect(reports).toBeGreaterThanOrEqual(0)
      expect(typeof shares).toBe('number')
      expect(shares).toBeGreaterThanOrEqual(0)
    },
  },
  {
    id: 'A.3',
    section: 'A',
    title: 'seeded officers exist with DMC / DUTY / DISTRICT roles',
    async run({ expect, seed }) {
      const officers = await prisma.officer.findMany({ where: { id: { in: seed.officerIds } } })
      expect(officers).toHaveLength(3)
      const roleById = new Map(officers.map((officer) => [officer.id, officer.role]))
      expect(roleById.get(seed.dmcOfficerId)).toBe('DMC_OFFICIAL')
      expect(roleById.get(seed.dutyOfficerId)).toBe('DUTY_OFFICER')
      expect(roleById.get(seed.districtOfficerId)).toBe('DISTRICT_OFFICER')
    },
  },
  {
    id: 'A.4',
    section: 'A',
    title: 'Kegalle + Gampaha districts and 3 partner orgs exist',
    async run({ expect, seed }) {
      const kegalle = await prisma.district.findUnique({ where: { id: seed.kegalleDistrictId } })
      const gampaha = await prisma.district.findUnique({ where: { id: seed.gampahaDistrictId } })
      expect(kegalle?.name).toBe('Kegalle')
      expect(gampaha?.name).toBe('Gampaha')
      const orgs = await prisma.organization.findMany({ where: { id: { in: seed.createdOrgIds } } })
      expect(orgs.map((org) => org.name).sort()).toEqual([
        'UC4 Test Armed Forces',
        'UC4 Test Private Donors',
        'UC4 Test Relief NGO',
      ])
    },
  },
  {
    id: 'A.5',
    section: 'A',
    title: 'seeded row counts match SEED_SPEC (reports and shares still 0)',
    async run({ expect, seed, log }) {
      const counts = await countOurRows(seed)
      expect(counts.districts).toBe(SEED_SPEC.districts)
      expect(counts.officers).toBe(SEED_SPEC.officers)
      expect(counts.organizations).toBe(SEED_SPEC.organizations)
      expect(counts.citizens).toBe(SEED_SPEC.citizens)
      expect(counts.alertTargets).toBe(SEED_SPEC.alertTargets)
      expect(counts.alerts).toBe(SEED_SPEC.alerts)
      expect(counts.attempts).toBe(SEED_SPEC.attempts)
      expect(counts.groundReports).toBe(SEED_SPEC.groundReports)
      expect(counts.auditEntries).toBe(SEED_SPEC.auditEntries)
      expect(counts.shelters).toBe(SEED_SPEC.shelters)
      expect(counts.occupancyEvents).toBe(SEED_SPEC.occupancyEvents)
      expect(counts.stocks).toBe(SEED_SPEC.stocks)
      expect(counts.distributions).toBe(SEED_SPEC.distributions)
      expect(counts.reports).toBe(0)
      expect(counts.shares).toBe(0)
      const specTotal = Object.values(SEED_SPEC).reduce((sum, value) => sum + value, 0)
      expect(counts.total).toBe(specTotal)
      log(`A.5: ${counts.total} seeded rows verified against SEED_SPEC`)
    },
  },
]

const checksB: Check[] = [
  {
    id: 'B.1',
    section: 'B',
    title: 'distinctCitizens === 1000 for the 2000 seeded attempts',
    async run({ expect, seed }) {
      const attempts = await new PrismaAttemptReader().listAttempts(sharedFilter(seed))
      expect(attempts).toHaveLength(2000)
      expect(new ReachCalculator().compute(attempts).distinctCitizens).toBe(1000)
    },
  },
  {
    id: 'B.2',
    section: 'B',
    title: 'PUSH channel stats are {1000 attempted, 950 delivered, 50 failed}',
    async run({ expect, seed }) {
      const attempts = await new PrismaAttemptReader().listAttempts(sharedFilter(seed))
      const reach = new ReachCalculator().compute(attempts)
      expect(reach.perChannel.PUSH).toEqual({ attempted: 1000, delivered: 950, failed: 50 })
    },
  },
  {
    id: 'B.3',
    section: 'B',
    title: 'SMS channel stats are {1000 attempted, 900 delivered, 100 failed}',
    async run({ expect, seed }) {
      const attempts = await new PrismaAttemptReader().listAttempts(sharedFilter(seed))
      const reach = new ReachCalculator().compute(attempts)
      expect(reach.perChannel.SMS).toEqual({ attempted: 1000, delivered: 900, failed: 100 })
    },
  },
  {
    id: 'B.4',
    section: 'B',
    title: 'empty attempt list computes all zeros',
    async run({ expect }) {
      expect(new ReachCalculator().compute([])).toEqual({
        distinctCitizens: 0,
        perChannel: {
          PUSH: { attempted: 0, delivered: 0, failed: 0 },
          SMS: { attempted: 0, delivered: 0, failed: 0 },
        },
      })
    },
  },
  {
    id: 'B.5',
    section: 'B',
    title: 'per-channel delivered sum 1850 differs from distinct 1000 (BR4)',
    async run({ expect, seed, log }) {
      const attempts = await new PrismaAttemptReader().listAttempts(sharedFilter(seed))
      const reach = new ReachCalculator().compute(attempts)
      const deliveredSum = reach.perChannel.PUSH.delivered + reach.perChannel.SMS.delivered
      expect(deliveredSum).toBe(1850)
      expect(reach.distinctCitizens).toBe(1000)
      expect(reach.distinctCitizens).not.toBe(deliveredSum)
      log(`B.5: delivered sum ${deliveredSum} vs distinct ${reach.distinctCitizens} (non-additive)`)
    },
  },
]

const checksC: Check[] = [
  {
    id: 'C.1',
    section: 'C',
    title: 'aggregate -> alerts, reports and shelters metrics match the seed',
    async run({ expect, seed }) {
      const metrics = await makeAggregation(dbReaders()).aggregate(
        validatedFilters(seed),
        FIXED_NOW,
        DEADLINE,
      )
      expect(metrics.alerts).toEqual(EXPECTED_ALERTS)
      expect(metrics.reports).toEqual(EXPECTED_REPORTS)
      expect(metrics.shelters.activated).toBe(2)
      expect(metrics.shelters.peakOccupancy).toBe(250)
      expect(metrics.shelters.events).toHaveLength(10)
    },
  },
  {
    id: 'C.2',
    section: 'C',
    title: 'reach metrics survive aggregation (A03.b)',
    async run({ expect, seed }) {
      const metrics = await makeAggregation(dbReaders()).aggregate(
        validatedFilters(seed),
        FIXED_NOW,
        DEADLINE,
      )
      expect(metrics.reach).toEqual(EXPECTED_REACH)
    },
  },
  {
    id: 'C.3',
    section: 'C',
    title: 'deadline in the past throws AggregationTimeoutError (A06.a)',
    async run({ expect, seed }) {
      const filters = validatedFilters(seed)
      const pastDeadline = new Date(0)
      const real = makeAggregation(dbReaders())
      await expect(real.aggregate(filters, FIXED_NOW, pastDeadline)).rejects.toThrow(
        AggregationTimeoutError,
      )
      const stuck = makeAggregation(neverReaders())
      await expect(stuck.aggregate(filters, FIXED_NOW, pastDeadline)).rejects.toThrow(
        AggregationTimeoutError,
      )
    },
  },
  {
    id: 'C.4',
    section: 'C',
    title: 'supplies metrics carry denominators and a null percent (A08.a)',
    async run({ expect, seed }) {
      const metrics = await makeAggregation(dbReaders()).aggregate(
        validatedFilters(seed),
        FIXED_NOW,
        DEADLINE,
      )
      expect(metrics.supplies.byType).toEqual(EXPECTED_SUPPLIES)
    },
  },
]

const checksD: Check[] = [
  {
    id: 'D.1',
    section: 'D',
    title: 'two generate() calls persist two distinct snapshots (A03.c)',
    async run({ expect, seed, reports }) {
      const bundle = makeSnapshotService()
      const first = await bundle.service.generate(filterInput(seed), dmcActor(seed))
      const second = await bundle.service.generate(
        filterInput(seed, { language: 'SI' }),
        dmcActor(seed),
      )
      reports.push(first.id, second.id)
      state.fullReportId = first.id
      expect(first.id).not.toBe(second.id)
      expect(first.filters.language).toBe('EN')
      expect(second.filters.language).toBe('SI')
      expect(await bundle.repo.getById(first.id)).not.toBeNull()
      expect(await bundle.repo.getById(second.id)).not.toBeNull()
      expect(bundle.audit.generations.map((entry) => entry.reportId)).toEqual([
        first.id,
        second.id,
      ])
    },
  },
  {
    id: 'D.2',
    section: 'D',
    title: 'snapshot is frozen and survives the DB round trip (A04)',
    async run({ expect, seed, reports }) {
      const bundle = makeSnapshotService()
      const report = await bundle.service.generate(
        filterInput(seed, { sections: ['ALERTS'] }),
        dmcActor(seed),
      )
      reports.push(report.id)
      expect(Object.isFrozen(report)).toBe(true)
      expect(report.sourceCutoff.getTime()).toBe(FIXED_NOW.getTime())
      const refetched = must(
        await bundle.repo.getById(report.id),
        `report ${report.id} missing after save`,
      )
      expect(Object.isFrozen(refetched)).toBe(true)
      expect(refetched.metrics).toEqual(report.metrics)
      expect(refetched.filters.from.getTime()).toBe(report.filters.from.getTime())
      expect(refetched.filters.to.getTime()).toBe(report.filters.to.getTime())
    },
  },
  {
    id: 'D.3',
    section: 'D',
    title: 'empty district scope yields warningFlag = true (A05)',
    async run({ expect, seed, reports }) {
      const bundle = makeSnapshotService()
      const report = await bundle.service.generate(
        filterInput(seed, { districtId: seed.gampahaDistrictId }),
        dmcActor(seed),
      )
      reports.push(report.id)
      state.warningReportId = report.id
      expect(report.warningFlag).toBe(true)
      const row = await prisma.analysisReport.findUnique({ where: { id: report.id } })
      expect(row?.warningFlag).toBe(true)
    },
  },
  {
    id: 'D.4',
    section: 'D',
    title: 'expired clock: timeout, nothing saved, audit TIMEOUT (A06.b)',
    async run({ expect, seed }) {
      const bundle = makeSnapshotService({ clock: expiredClock() })
      const before = await prisma.analysisReport.count({
        where: { generatedBy: { in: seed.officerIds } },
      })
      await expect(bundle.service.generate(filterInput(seed), dmcActor(seed))).rejects.toThrow(
        AggregationTimeoutError,
      )
      const after = await prisma.analysisReport.count({
        where: { generatedBy: { in: seed.officerIds } },
      })
      expect(after).toBe(before)
      expect(bundle.audit.failures).toEqual([{ reason: 'TIMEOUT', actorId: seed.dmcOfficerId }])
    },
  },
  {
    id: 'D.5',
    section: 'D',
    title: 'district scope changes every metric consistently (A09)',
    async run({ expect, seed, reports, log }) {
      const bundle = makeSnapshotService()
      const full = await bundle.service.generate(filterInput(seed), dmcActor(seed))
      const empty = await bundle.service.generate(
        filterInput(seed, { districtId: seed.gampahaDistrictId }),
        dmcActor(seed),
      )
      reports.push(full.id, empty.id)
      expect(full.metrics.alerts.total).toBe(3)
      expect(full.metrics.reach.distinctCitizens).toBe(1000)
      expect(full.metrics.reports.verified).toBe(42)
      expect(full.metrics.shelters.activated).toBe(2)
      expect(Object.keys(full.metrics.supplies.byType)).toHaveLength(3)
      expect(empty.metrics.alerts.total).toBe(0)
      expect(empty.metrics.reach.distinctCitizens).toBe(0)
      expect(empty.metrics.reports).toEqual({ verified: 0, rejected: 0, pending: 0 })
      expect(empty.metrics.shelters.activated).toBe(0)
      expect(empty.metrics.supplies.byType).toEqual({})
      expect(full.warningFlag).toBe(false)
      expect(empty.warningFlag).toBe(true)
      log('D.5: Kegalle scope fully populated, Gampaha scope fully empty')
    },
  },
]

const checksE: Check[] = [
  {
    id: 'E.1',
    section: 'E',
    title: 'full-snapshot PDF is a valid %PDF with the EN title (A11.a)',
    async run({ expect }) {
      const report = must(
        await new PrismaSnapshotRepository().getById(state.fullReportId),
        'D.1 full report is missing',
      )
      const bytes = await new PdfExporter().export(report, report.filters.language)
      expect(bytes.length).toBeGreaterThan(1000)
      expect(Buffer.from(bytes.slice(0, 5)).toString('latin1')).toBe('%PDF-')
      expect(extractPdfText(bytes)).toContain('Post-Event Analysis Report')
    },
  },
  {
    id: 'E.2',
    section: 'E',
    title: 'PDFDocument loads and all 5 section labels render (A11.b)',
    async run({ expect }) {
      const { PDFDocument } = await import('pdf-lib')
      const report = must(
        await new PrismaSnapshotRepository().getById(state.fullReportId),
        'D.1 full report is missing',
      )
      const bytes = await new PdfExporter().export(report, report.filters.language)
      const doc = await PDFDocument.load(bytes)
      expect(doc.getPageCount()).toBeGreaterThanOrEqual(1)
      const text = extractPdfText(bytes)
      for (const label of ['Alerts', 'Reach', 'Ground Reports', 'Shelters', 'Relief Supplies']) {
        expect(text).toContain(label)
      }
    },
  },
  {
    id: 'E.3',
    section: 'E',
    title: 'PDF renders the computed metric values (A11.c)',
    async run({ expect }) {
      const report = must(
        await new PrismaSnapshotRepository().getById(state.fullReportId),
        'D.1 full report is missing',
      )
      const text = extractPdfText(await new PdfExporter().export(report, report.filters.language))
      expect(text).toContain('Distinct Citizens Reached: 1000')
      expect(text).toContain('Verified: 42')
      expect(text).toContain('Total: 3')
      expect(text).toContain('Peak Occupancy: 250')
    },
  },
  {
    id: 'E.4',
    section: 'E',
    title: 'warningFlag snapshot PDF renders the no-activity line (A11.d)',
    async run({ expect }) {
      const { PDFDocument } = await import('pdf-lib')
      const report = must(
        await new PrismaSnapshotRepository().getById(state.warningReportId),
        'D.3 warning report is missing',
      )
      expect(report.warningFlag).toBe(true)
      const bytes = await new PdfExporter().export(report, 'EN')
      const doc = await PDFDocument.load(bytes)
      expect(doc.getPageCount()).toBeGreaterThanOrEqual(1)
      expect(extractPdfText(bytes)).toContain('No activity recorded for this period.')
    },
  },
]

const checksF: Check[] = [
  {
    id: 'F.1',
    section: 'F',
    title: 'share of 3 orgs logs [SENT, FAILED, SENT] with names (A07.a)',
    async run({ expect, seed }) {
      const channel = new MockPartnerChannel(new ScriptedRng([0.9, 0.1, 0.9]), 0.5)
      const bundle = makeShareService(seed, channel)
      const outcomes = await bundle.service.share(
        state.fullReportId,
        [seed.ngoOrgId, seed.armedOrgId, seed.donorOrgId],
        dmcActor(seed),
      )
      expect(outcomes.map((outcome) => outcome.status)).toEqual(['SENT', 'FAILED', 'SENT'])
      expect(outcomes.map((outcome) => outcome.organizationName)).toEqual([
        'UC4 Test Relief NGO',
        'UC4 Test Armed Forces',
        'UC4 Test Private Donors',
      ])
      const rows = await prisma.reportShare.findMany({
        where: { reportId: state.fullReportId },
      })
      expect(rows).toHaveLength(3)
      expect(rows.filter((row) => row.status === 'FAILED').map((row) => row.failureReason)).toEqual([
        'Mock delivery failed for UC4 Test Armed Forces',
      ])
      expect(bundle.audit.shares).toEqual([
        { reportId: state.fullReportId, actorId: seed.dmcOfficerId, count: 3 },
      ])
    },
  },
  {
    id: 'F.2',
    section: 'F',
    title: 'retry appends a 4th row — append-only history (A07.b)',
    async run({ expect, seed }) {
      const channel = new MockPartnerChannel(new ScriptedRng([]), 0)
      const bundle = makeShareService(seed, channel)
      const outcomes = await bundle.service.share(
        state.fullReportId,
        [seed.armedOrgId],
        dmcActor(seed),
      )
      expect(outcomes.map((outcome) => outcome.status)).toEqual(['SENT'])
      const rows = await prisma.reportShare.findMany({
        where: { reportId: state.fullReportId },
      })
      expect(rows).toHaveLength(4)
      expect(new Set(rows.map((row) => row.id)).size).toBe(4)
    },
  },
  {
    id: 'F.3',
    section: 'F',
    title: 'empty organizationIds throws ValidationError (A07.c)',
    async run({ expect, seed }) {
      const bundle = makeShareService(seed, new MockPartnerChannel(new ScriptedRng([]), 0))
      await expect(
        bundle.service.share(state.fullReportId, [], dmcActor(seed)),
      ).rejects.toThrow(ValidationError)
    },
  },
  {
    id: 'F.4',
    section: 'F',
    title: 'unknown reportId throws NotFoundError and logs nothing (A07.d)',
    async run({ expect, seed }) {
      const bundle = makeShareService(seed, new MockPartnerChannel(new ScriptedRng([]), 0))
      const missingId = crypto.randomUUID()
      await expect(
        bundle.service.share(missingId, [seed.ngoOrgId], dmcActor(seed)),
      ).rejects.toThrow(NotFoundError)
      expect(await prisma.reportShare.count({ where: { reportId: missingId } })).toBe(0)
    },
  },
  {
    id: 'F.5',
    section: 'F',
    title: 'all deliveries fail: outcomes FAILED, report survives (A07.e)',
    async run({ expect, seed, reports }) {
      const channel = new MockPartnerChannel(new ScriptedRng([0.1, 0.1, 0.1]), 0.5)
      const bundle = makeShareService(seed, channel)
      const report = await saveSnapshot(bundle.repo, seed)
      reports.push(report.id)
      const outcomes = await bundle.service.share(
        report.id,
        [seed.ngoOrgId, seed.armedOrgId, seed.donorOrgId],
        dmcActor(seed),
      )
      expect(outcomes.map((outcome) => outcome.status)).toEqual(['FAILED', 'FAILED', 'FAILED'])
      expect(outcomes.every((outcome) => outcome.organizationName !== '?')).toBe(true)
      const rows = await prisma.reportShare.findMany({ where: { reportId: report.id } })
      expect(rows).toHaveLength(3)
      expect(rows.every((row) => row.failureReason !== null)).toBe(true)
      expect(await bundle.repo.getById(report.id)).not.toBeNull()
      expect(bundle.audit.shares[0]?.count).toBe(3)
    },
  },
  {
    id: 'F.6',
    section: 'F',
    title: 'unknown organization returns FAILED without FK violation (A07.f)',
    async run({ expect, seed }) {
      const channel = new MockPartnerChannel(new ScriptedRng([]), 0)
      const bundle = makeShareService(seed, channel)
      const report = await saveSnapshot(bundle.repo, seed)
      // Use a nonexistent org ID - StaticOrganizationReader returns null
      const outcomes = await bundle.service.share(
        report.id,
        ['nonexistent-org-uuid-xyz'],
        dmcActor(seed),
      )
      expect(outcomes).toHaveLength(1)
      expect(outcomes[0].status).toBe('FAILED')
      expect(outcomes[0].failureReason).toBe('Unknown organization')
      expect(outcomes[0].organizationName).toBe('?')
      // No FK error thrown, no row persisted for unknown org
      const shareCount = await prisma.reportShare.count({ where: { reportId: report.id } })
      expect(shareCount).toBe(0)
    },
  },
]

const checksG: Check[] = [
  {
    id: 'G.BR1',
    section: 'G',
    title: 'role guard rejects non-DMC actors (BR1 / API requireRole)',
    async run({ expect, seed, log }) {
      const actors: Actor[] = [
        { id: seed.reporterCitizenId, role: 'CITIZEN' },
        { id: seed.dutyOfficerId, role: 'DUTY_OFFICER' },
        { id: seed.districtOfficerId, role: 'DISTRICT_OFFICER' },
      ]
      for (const actor of actors) {
        try {
          requireRole(actor, ['DMC_OFFICIAL'])
          expect.unreachable(`role ${actor.role} must not pass requireRole`)
        } catch (error) {
          expect(error).toBeInstanceOf(ForbiddenError)
          expect((error as ForbiddenError).role).toBe(actor.role)
          expect((error as ForbiddenError).action).toContain('DMC_OFFICIAL')
        }
      }
      expect(() => requireRole(dmcActor(seed), ['DMC_OFFICIAL'])).not.toThrow()
      log('G.BR1: SnapshotService itself performs no role check — enforcement is API-side (deviation listed in findings)')
    },
  },
  {
    id: 'G.BR2',
    section: 'G',
    title: 'snapshot metrics unchanged after source changes; write-once (BR2)',
    async run({ expect, seed, reports }) {
      const bundle = makeSnapshotService()
      const report = await bundle.service.generate(
        filterInput(seed, { sections: ['ALERTS'] }),
        dmcActor(seed),
      )
      reports.push(report.id)
      const snapshotBefore = JSON.parse(JSON.stringify(report.metrics)) as unknown
      const lateAlert = await prisma.hazardAlert.create({
        data: {
          hazardType: 'FLOOD',
          severity: 'EMERGENCY',
          status: 'ACTIVE',
          message: 'UC4 late alert for immutability check',
          issuedById: seed.dmcOfficerId,
          occurredAt: new Date('2026-08-25T06:00:00.000Z'),
        },
      })
      await prisma.alertTargetDistrict.create({
        data: { alertId: lateAlert.id, districtId: seed.kegalleDistrictId },
      })
      try {
        const recomputed = await makeAggregation(dbReaders()).aggregate(
          validatedFilters(seed),
          FIXED_NOW,
          DEADLINE,
        )
        expect(recomputed.alerts.total).toBe(4)
        const refetched = must(
          await bundle.repo.getById(report.id),
          `report ${report.id} missing after source change`,
        )
        expect(JSON.parse(JSON.stringify(refetched.metrics))).toEqual(snapshotBefore)
        await expect(bundle.repo.save(report)).rejects.toThrow(ValidationError)
      } finally {
        await prisma.alertTargetDistrict.deleteMany({ where: { alertId: lateAlert.id } })
        await prisma.hazardAlert.delete({ where: { id: lateAlert.id } })
      }
    },
  },
  {
    id: 'G.BR3',
    section: 'G',
    title: 'distinctCitizens equals COUNT(DISTINCT citizen_id) in SQL (BR3)',
    async run({ expect, seed }) {
      const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT "citizen_id") AS count
        FROM "notification_attempt"
        WHERE "district_id" = ${seed.kegalleDistrictId} AND "status" = 'DELIVERED'`
      const sqlCount = Number(rows[0].count)
      expect(sqlCount).toBe(1000)
      const metrics = await makeAggregation(dbReaders()).aggregate(
        validatedFilters(seed),
        FIXED_NOW,
        DEADLINE,
      )
      expect(metrics.reach.distinctCitizens).toBe(sqlCount)
    },
  },
  {
    id: 'G.BR4',
    section: 'G',
    title: 'per-channel delivered sum is non-additive vs distinct (BR4)',
    async run({ expect, seed }) {
      const attempts = await new PrismaAttemptReader().listAttempts(sharedFilter(seed))
      const reach = new ReachCalculator().compute(attempts)
      const deliveredSum = reach.perChannel.PUSH.delivered + reach.perChannel.SMS.delivered
      expect(deliveredSum).toBe(1850)
      expect(reach.distinctCitizens).toBe(1000)
      expect(deliveredSum).toBeGreaterThan(reach.distinctCitizens)
    },
  },
  {
    id: 'G.BR5',
    section: 'G',
    title: 'all 5 readers receive one identical shared filter (BR5)',
    async run({ expect, seed }) {
      const recording = new RecordingReaders()
      const filters = validatedFilters(seed)
      await makeAggregation(recording).aggregate(filters, FIXED_NOW, DEADLINE)
      expect(recording.filters).toHaveLength(6)
      const first = recording.filters[0]
      for (const recorded of recording.filters) {
        expect(recorded).toBe(first)
      }
      expect(first.from?.getTime()).toBe(filters.from.getTime())
      expect(first.to?.getTime()).toBe(filters.to.getTime())
      expect(first.districtId).toBe(seed.kegalleDistrictId)
      expect(first.hazardType).toBe('FLOOD')
      expect(first.cutoff?.getTime()).toBe(FIXED_NOW.getTime())
    },
  },
  {
    id: 'G.BR6',
    section: 'G',
    title: 'timeout never calls repository.save (BR6 / CountingRepository)',
    async run({ expect, seed }) {
      const counting = new CountingRepository(new PrismaSnapshotRepository())
      const bundle = makeSnapshotService({
        readers: neverReaders(),
        clock: expiredClock(),
        repo: counting,
      })
      const before = await prisma.analysisReport.count()
      await expect(bundle.service.generate(filterInput(seed), dmcActor(seed))).rejects.toThrow(
        AggregationTimeoutError,
      )
      expect(counting.saves).toBe(0)
      expect(await prisma.analysisReport.count()).toBe(before)
    },
  },
  {
    id: 'G.BR7',
    section: 'G',
    title: 'empty time window yields warningFlag = true in DB (BR7)',
    async run({ expect, seed, reports }) {
      const bundle = makeSnapshotService()
      const input = { ...filterInput(seed), from: '2026-07-01', to: '2026-07-31' }
      const report = await bundle.service.generate(input, dmcActor(seed))
      reports.push(report.id)
      expect(report.warningFlag).toBe(true)
      expect(report.metrics.alerts.total).toBe(0)
      const row = await prisma.analysisReport.findUnique({ where: { id: report.id } })
      expect(row?.warningFlag).toBe(true)
    },
  },
  {
    id: 'G.BR8',
    section: 'G',
    title: 'two share batches append 6 rows with distinct ids (BR8)',
    async run({ expect, seed, reports }) {
      const bundle = makeShareService(seed, new MockPartnerChannel(new ScriptedRng([]), 0))
      const report = await saveSnapshot(bundle.repo, seed)
      reports.push(report.id)
      const ids = [seed.ngoOrgId, seed.armedOrgId, seed.donorOrgId]
      await bundle.service.share(report.id, ids, dmcActor(seed))
      await bundle.service.share(report.id, ids, dmcActor(seed))
      const rows = await prisma.reportShare.findMany({ where: { reportId: report.id } })
      expect(rows).toHaveLength(6)
      expect(new Set(rows.map((row) => row.id)).size).toBe(6)
    },
  },
  {
    id: 'G.BR9',
    section: 'G',
    title: 'one failed recipient does not stop the batch (BR9)',
    async run({ expect, seed, reports }) {
      const channel = new MockPartnerChannel(new ScriptedRng([0.9, 0.1, 0.9]), 0.5)
      const bundle = makeShareService(seed, channel)
      const report = await saveSnapshot(bundle.repo, seed)
      reports.push(report.id)
      const outcomes = await bundle.service.share(
        report.id,
        [seed.ngoOrgId, seed.armedOrgId, seed.donorOrgId],
        dmcActor(seed),
      )
      expect(outcomes.map((outcome) => outcome.status)).toEqual(['SENT', 'FAILED', 'SENT'])
      expect(await prisma.reportShare.count({ where: { reportId: report.id } })).toBe(3)
      expect(await bundle.repo.getById(report.id)).not.toBeNull()
    },
  },
  {
    id: 'G.BR10',
    section: 'G',
    title: 'zero denominator gives percent null; FOOD/WATER numeric (BR10)',
    async run({ expect, seed }) {
      const metrics = await makeAggregation(dbReaders()).aggregate(
        validatedFilters(seed),
        FIXED_NOW,
        DEADLINE,
      )
      expect(metrics.supplies.byType.MEDICINE).toEqual({
        distributed: 100,
        total: 0,
        percent: null,
      })
      expect(metrics.supplies.byType.FOOD).toEqual(EXPECTED_SUPPLIES.FOOD)
      expect(metrics.supplies.byType.WATER).toEqual(EXPECTED_SUPPLIES.WATER)
    },
  },
  {
    id: 'G.BR11',
    section: 'G',
    title: 'invalid ranges throw ValidationError without persisting (BR11 / A01)',
    async run({ expect, seed }) {
      const bundle = makeSnapshotService()
      const before = await prisma.analysisReport.count()
      const reversed = await bundle.service
        .generate({ ...filterInput(seed), from: '2026-08-31', to: '2026-08-01' }, dmcActor(seed))
        .catch((error: unknown) => error)
      expect(reversed).toBeInstanceOf(ValidationError)
      expect((reversed as ValidationError).fields).toEqual(['from'])
      await expect(
        bundle.service.generate(
          { ...filterInput(seed), from: '2023-01-01', to: '2026-08-31' },
          dmcActor(seed),
        ),
      ).rejects.toThrow(ValidationError)
      expect(await prisma.analysisReport.count()).toBe(before)
    },
  },
  {
    id: 'G.BR12',
    section: 'G',
    title: 'includedSections gate the PDF and round-trip in DB (BR12)',
    async run({ expect, seed, reports }) {
      const bundle = makeSnapshotService()
      const report = await bundle.service.generate(
        filterInput(seed, { sections: ['ALERTS'] }),
        dmcActor(seed),
      )
      reports.push(report.id)
      expect(report.filters.includedSections).toEqual(['ALERTS'])
      const refetched = must(
        await bundle.repo.getById(report.id),
        `report ${report.id} missing after save`,
      )
      expect(refetched.filters.includedSections).toEqual(['ALERTS'])
      expect(refetched.metrics.reach.distinctCitizens).toBe(1000)
      const text = extractPdfText(await new PdfExporter().export(refetched, 'EN'))
      expect(text).toContain('Alerts')
      expect(text).not.toContain('Reach')
      expect(text).not.toContain('Ground Reports')
      expect(text).not.toContain('Shelters')
      expect(text).not.toContain('Relief Supplies')
    },
  },
]

const checksH: Check[] = [
  {
    id: 'H.1',
    section: 'H',
    title: 'ROLE-01: DISTRICT_OFFICER is rejected by requireRole',
    async run({ expect, seed }) {
      const request = new Request(API, {
        headers: { cookie: jsonCookie('DISTRICT_OFFICER', seed.districtOfficerId) },
      })
      const actor = await getActor(request)
      expect(actor).toEqual({ id: seed.districtOfficerId, role: 'DISTRICT_OFFICER' })
      try {
        requireRole(actor, ['DMC_OFFICIAL'])
        expect.unreachable('DISTRICT_OFFICER must be rejected')
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenError)
        expect((error as ForbiddenError).role).toBe('DISTRICT_OFFICER')
        expect((error as ForbiddenError).action).toContain('DMC_OFFICIAL')
      }
    },
  },
  {
    id: 'H.2',
    section: 'H',
    title: 'ROLE-02: CITIZEN and a missing cookie are rejected',
    async run({ expect, seed }) {
      const request = new Request(API, {
        headers: { cookie: jsonCookie('CITIZEN', seed.reporterCitizenId) },
      })
      const actor = await getActor(request)
      expect(() => requireRole(actor, ['DMC_OFFICIAL'])).toThrow(ForbiddenError)
      try {
        requireRole(actor, ['DMC_OFFICIAL'])
        expect.unreachable('CITIZEN must be rejected')
      } catch (error) {
        expect((error as ForbiddenError).role).toBe('CITIZEN')
      }
      const anonymous = await getActor(new Request(API)).catch((error: unknown) => error)
      expect(anonymous).toBeInstanceOf(ForbiddenError)
      expect((anonymous as ForbiddenError).role).toBe('ANONYMOUS')
    },
  },
  {
    id: 'H.3',
    section: 'H',
    title: 'ROLE-03: DMC_OFFICIAL passes; bare-role cookie resolves',
    async run({ expect, seed }) {
      const request = new Request(API, {
        headers: { cookie: jsonCookie('DMC_OFFICIAL', seed.dmcOfficerId) },
      })
      const actor = await getActor(request)
      expect(actor).toEqual({ id: seed.dmcOfficerId, role: 'DMC_OFFICIAL' })
      expect(() => requireRole(actor, ['DMC_OFFICIAL'])).not.toThrow()
      expect(requireRole(actor, ['DMC_OFFICIAL'])).toBeUndefined()
      const bare = await getActor(new Request(API, { headers: { cookie: bareCookie('DMC_OFFICIAL') } }))
      expect(bare).toEqual({ id: 'cookie-dmc_official', role: 'DMC_OFFICIAL' })
      const unknown = await getActor(
        new Request(API, {
          headers: {
            cookie: `actor=${encodeURIComponent(JSON.stringify({ id: 'x', role: 'SUPER_ADMIN' }))}`,
          },
        }),
      ).catch((error: unknown) => error)
      expect(unknown).toBeInstanceOf(ForbiddenError)
      expect((unknown as ForbiddenError).role).toBe('UNKNOWN')
    },
  },
]

const checksI: Check[] = [
  {
    id: 'I.1',
    section: 'I',
    title: 'POST /api/analysis without cookie -> 403',
    async run({ expect, seed }) {
      const { POST } = await import('@/app/api/analysis/route')
      const response = await POST(
        new Request(API, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(filterInput(seed)),
        }),
      )
      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({ error: 'Forbidden' })
    },
  },
  {
    id: 'I.2',
    section: 'I',
    title: 'POST /api/analysis with citizen cookie -> 403',
    async run({ expect, seed }) {
      const { POST } = await import('@/app/api/analysis/route')
      const response = await POST(
        new Request(API, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            cookie: jsonCookie('CITIZEN', seed.reporterCitizenId),
          },
          body: JSON.stringify(filterInput(seed)),
        }),
      )
      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({ error: 'Forbidden' })
    },
  },
  {
    id: 'I.3',
    section: 'I',
    title: 'POST /api/analysis with reversed range -> 400 ValidationError',
    async run({ expect, seed }) {
      const { POST } = await import('@/app/api/analysis/route')
      const response = await POST(
        new Request(API, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            cookie: jsonCookie('DMC_OFFICIAL', seed.dmcOfficerId),
          },
          body: JSON.stringify({ ...filterInput(seed), from: WINDOW.to, to: WINDOW.from }),
        }),
      )
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'ValidationError', fields: ['from'] })
    },
  },
  {
    id: 'I.4',
    section: 'I',
    title: 'POST /api/analysis with DMC cookie -> 201 and persists',
    async run({ expect, seed, reports, log }) {
      const { POST } = await import('@/app/api/analysis/route')
      const response = await POST(
        new Request(API, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            cookie: jsonCookie('DMC_OFFICIAL', seed.dmcOfficerId),
          },
          body: JSON.stringify(filterInput(seed)),
        }),
      )
      expect(response.status).toBe(201)
      const body: {
        reportId?: string
        filters?: { districtId?: string }
        metrics?: {
          alerts?: { total?: number }
          reach?: { distinctCitizens?: number }
          reports?: { verified?: number; rejected?: number; pending?: number }
          shelters?: { activated?: number }
          supplies?: { byType?: Record<string, unknown> }
        }
      } = await response.json()
      expect(typeof body.reportId).toBe('string')
      state.routeReportId = body.reportId ?? ''
      reports.push(state.routeReportId)
      expect(body.filters?.districtId).toBe(seed.kegalleDistrictId)
      expect(body.metrics?.reports).toEqual({ verified: 42, rejected: 3, pending: 6 })
      if (process.env.DATA_STORE === 'prisma') {
        expect(body.metrics?.alerts?.total).toBe(3)
        expect(body.metrics?.reach?.distinctCitizens).toBe(1000)
        expect(body.metrics?.shelters?.activated).toBe(2)
      } else {
        expect(body.metrics?.alerts?.total).toBe(0)
        expect(body.metrics?.reach?.distinctCitizens).toBe(0)
        expect(body.metrics?.shelters?.activated).toBe(0)
        expect(body.metrics?.supplies?.byType).toEqual({})
      }
      const row = await prisma.analysisReport.findUnique({ where: { id: state.routeReportId } })
      expect(row?.warningFlag).toBe(false)
      expect(row?.generatedBy).toBe(seed.dmcOfficerId)
      log(`I.4: route generated report ${state.routeReportId}`)
    },
  },
  {
    id: 'I.5',
    section: 'I',
    title: 'GET /api/analysis lists reports; wrong role -> 403',
    async run({ expect, seed }) {
      const { GET } = await import('@/app/api/analysis/route')
      const ok = await GET(
        new Request(`${API}?limit=100`, {
          headers: { cookie: jsonCookie('DMC_OFFICIAL', seed.dmcOfficerId) },
        }),
      )
      expect(ok.status).toBe(200)
      const list: Array<{ id: string }> = await ok.json()
      expect(Array.isArray(list)).toBe(true)
      expect(list.some((report) => report.id === state.routeReportId)).toBe(true)
      const denied = await GET(
        new Request(API, {
          headers: { cookie: jsonCookie('DUTY_OFFICER', seed.dutyOfficerId) },
        }),
      )
      expect(denied.status).toBe(403)
    },
  },
  {
    id: 'I.6',
    section: 'I',
    title: 'GET /api/analysis/[id] round-trips; unknown -> 404',
    async run({ expect, seed }) {
      const { GET } = await import('@/app/api/analysis/[id]/route')
      const request = new Request(API, {
        headers: { cookie: jsonCookie('DMC_OFFICIAL', seed.dmcOfficerId) },
      })
      const response = await GET(request, {
        params: Promise.resolve({ id: state.routeReportId }),
      })
      expect(response.status).toBe(200)
      const body: { id?: string; filters?: { language?: string } } = await response.json()
      expect(body.id).toBe(state.routeReportId)
      expect(body.filters?.language).toBe('EN')
      const missing = await GET(request, {
        params: Promise.resolve({ id: crypto.randomUUID() }),
      })
      expect(missing.status).toBe(404)
      expect(await missing.json()).toEqual({ error: 'NotFound' })
    },
  },
  {
    id: 'I.7',
    section: 'I',
    title: 'GET /api/analysis/[id]/pdf returns PDF bytes; unknown -> 404',
    async run({ expect, seed }) {
      const { GET } = await import('@/app/api/analysis/[id]/pdf/route')
      const request = new Request(API, {
        headers: { cookie: jsonCookie('DMC_OFFICIAL', seed.dmcOfficerId) },
      })
      const response = await GET(request, {
        params: Promise.resolve({ id: state.routeReportId }),
      })
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('application/pdf')
      const bytes = new Uint8Array(await response.arrayBuffer())
      expect(bytes.length).toBeGreaterThan(1000)
      expect(Buffer.from(bytes.slice(0, 5)).toString('latin1')).toBe('%PDF-')
      expect(extractPdfText(bytes)).toContain('Post-Event Analysis Report')
      const missing = await GET(request, {
        params: Promise.resolve({ id: crypto.randomUUID() }),
      })
      expect(missing.status).toBe(404)
    },
  },
  {
    id: 'I.8',
    section: 'I',
    title: 'POST share -> 200 outcomes; empty -> 400; unknown report -> 404',
    async run({ expect, seed, log }) {
      const { POST } = await import('@/app/api/analysis/[id]/share/route')
      const cookie = jsonCookie('DMC_OFFICIAL', seed.dmcOfficerId)
      const targetReportId = state.routeReportId || state.fullReportId
      const shareRequest = (payload: unknown): Request =>
        new Request(`${API}/${targetReportId}/share`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie },
          body: JSON.stringify(payload),
        })
      const response = await POST(shareRequest({
        organizationIds: [seed.ngoOrgId, seed.armedOrgId, seed.donorOrgId],
      }), {
        params: Promise.resolve({ id: targetReportId }),
      })
      expect(response.status).toBe(200)
      const body: { outcomes?: Array<{ status?: string; organizationName?: string }> } =
        await response.json()
      expect(body.outcomes).toHaveLength(3)
      expect(body.outcomes?.map((outcome) => outcome.status)).toEqual([
        'FAILED',
        'FAILED',
        'FAILED',
      ])
      expect(body.outcomes?.[0]?.organizationName).toBe('?')
      expect(
        await prisma.reportShare.count({ where: { reportId: targetReportId } }),
      ).toBe(0)
      log('I.8: container organizationReader is a null stub, so all three outcomes are FAILED (see findings)')
      const empty = await POST(shareRequest({ organizationIds: [] }), {
        params: Promise.resolve({ id: state.routeReportId }),
      })
      expect(empty.status).toBe(400)
      expect(await empty.json()).toEqual({ error: 'ValidationError', fields: ['organizationIds'] })
      const unknownReport = await POST(shareRequest({ organizationIds: [seed.ngoOrgId] }), {
        params: Promise.resolve({ id: crypto.randomUUID() }),
      })
      expect(unknownReport.status).toBe(404)
    },
  },
]

const checksJ: Check[] = [
  {
    id: 'J.1',
    section: 'J',
    title: 'suite created analysis_report and report_share rows',
    async run({ expect, seed, log }) {
      const counts = await countOurRows(seed)
      expect(counts.reports).toBeGreaterThan(0)
      expect(counts.shares).toBeGreaterThan(0)
      log(`J.1: ${counts.reports} reports, ${counts.shares} share rows created by this suite`)
    },
  },
  {
    id: 'J.2',
    section: 'J',
    title: 'report row carries filters, metrics, cutoff and generatedAt',
    async run({ expect, seed }) {
      const row = await prisma.analysisReport.findFirst({
        where: { id: state.fullReportId },
      })
      expect(row).not.toBeNull()
      if (row === null) {
        throw new Error('no analysis_report row generated by this suite')
      }
      expect(row.filters).not.toBeNull()
      expect(row.metrics).not.toBeNull()
      expect(row.sourceCutoff).toBeInstanceOf(Date)
      expect(row.generatedAt).toBeInstanceOf(Date)
      expect(typeof row.warningFlag).toBe('boolean')
      const metrics = row.metrics as { reports?: { verified?: number } }
      expect(metrics.reports?.verified).toBe(42)
    },
  },
  {
    id: 'J.3',
    section: 'J',
    title: 'JOIN analysis_report -> officer resolves the seeded DMC officer',
    async run({ expect, seed }) {
      const rows = await prisma.$queryRaw<Array<{ name: string; role: string }>>`
        SELECT o.name, o.role
        FROM analysis_report ar
        JOIN officer o ON o.id = ar.generated_by
        WHERE ar.generated_by = ${seed.dmcOfficerId}
        LIMIT 1`
      expect(rows).toHaveLength(1)
      expect(rows[0].name).toBe('UC4 DMC Official')
      expect(rows[0].role).toBe('DMC_OFFICIAL')
    },
  },
  {
    id: 'J.4',
    section: 'J',
    title: 'JOIN report_share -> analysis_report -> organization resolves',
    async run({ expect, seed }) {
      const rows = await prisma.$queryRaw<Array<{ name: string; status: string }>>`
        SELECT org.name, rs.status
        FROM report_share rs
        JOIN analysis_report ar ON ar.id = rs.report_id
        JOIN organization org ON org.id = rs.organization_id
        WHERE rs.actor_id = ${seed.dmcOfficerId}`
      expect(rows.length).toBeGreaterThan(0)
      const allowed = new Set([
        'UC4 Test Relief NGO',
        'UC4 Test Armed Forces',
        'UC4 Test Private Donors',
      ])
      for (const row of rows) {
        expect(allowed.has(row.name)).toBe(true)
        expect(['SENT', 'FAILED']).toContain(row.status)
      }
    },
  },
  {
    id: 'J.5',
    section: 'J',
    title: 'raw SQL COUNT(*) matches Prisma counts',
    async run({ expect }) {
      const reportCount = await prisma.analysisReport.count()
      const shareCount = await prisma.reportShare.count()
      const rawReports = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) AS count FROM analysis_report`
      const rawShares = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) AS count FROM report_share`
      expect(Number(rawReports[0].count)).toBe(reportCount)
      expect(Number(rawShares[0].count)).toBe(shareCount)
      expect(reportCount).toBeGreaterThan(0)
      expect(shareCount).toBeGreaterThan(0)
    },
  },
]

export const CHECKS: readonly Check[] = [
  ...checksA,
  ...checksB,
  ...checksC,
  ...checksD,
  ...checksE,
  ...checksF,
  ...checksG,
  ...checksH,
  ...checksI,
  ...checksJ,
]

export function summarize(
  checks: readonly Check[],
  results: ReadonlyMap<string, 'pass' | 'fail'>,
): SectionSummary[] {
  return SECTIONS.map((section) => {
    const inSection = checks.filter((check) => check.section === section.key)
    let pass = 0
    let fail = 0
    for (const check of inSection) {
      const outcome = results.get(check.id)
      if (outcome === 'pass') {
        pass += 1
      } else if (outcome === 'fail') {
        fail += 1
      }
    }
    return {
      key: section.key,
      title: section.title,
      total: inSection.length,
      pass,
      fail,
      skip: inSection.length - pass - fail,
    }
  })
}

export function totals(rows: readonly SectionSummary[]): {
  total: number
  pass: number
  fail: number
  skip: number
} {
  return rows.reduce(
    (acc, row) => ({
      total: acc.total + row.total,
      pass: acc.pass + row.pass,
      fail: acc.fail + row.fail,
      skip: acc.skip + row.skip,
    }),
    { total: 0, pass: 0, fail: 0, skip: 0 },
  )
}

export function renderTable(rows: readonly SectionSummary[]): string {
  const header =
    `${'Section'.padEnd(56)}` +
    `${'Total'.padStart(7)}` +
    `${'Pass'.padStart(7)}` +
    `${'Fail'.padStart(7)}` +
    `${'Skip'.padStart(7)}`
  const divider = '-'.repeat(56 + 28)
  const line = (label: string, row: Omit<SectionSummary, 'key' | 'title'>): string =>
    `${label.padEnd(56)}` +
    `${String(row.total).padStart(7)}` +
    `${String(row.pass).padStart(7)}` +
    `${String(row.fail).padStart(7)}` +
    `${String(row.skip).padStart(7)}`
  return [
    header,
    divider,
    ...rows.map((row) => line(row.title, row)),
    divider,
    line('TOTAL', totals(rows)),
  ].join('\n')
}
