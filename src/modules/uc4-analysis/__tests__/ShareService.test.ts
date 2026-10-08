import { describe, expect, it } from 'vitest'

import type { Actor } from '@/shared/contracts/types'
import { FakeClock, SequentialIdGenerator } from '@/shared/infra/fakes'
import { InMemoryShareLogRepository } from '@/shared/infra/InMemoryShareLogRepository'
import { InMemorySnapshotRepository } from '@/shared/infra/InMemorySnapshotRepository'

import type { AuditLogger } from '../adapters/AuditLogger'
import { MockPartnerChannel } from '../adapters/MockPartnerChannel'
import type { Organization, OrganizationReader } from '../adapters/PartnerChannel'
import type { AnalysisReport } from '../domain/AnalysisReport'
import { NotFoundError, ValidationError } from '../domain/errors'
import type { ShareOutcome } from '../domain/ShareOutcome'
import { ShareService } from '../services/ShareService'

// ─── Test doubles ─────────────────────────────────────────────────────────────

/** Scripted RNG: returns the next preset value, then 0 forever. */
class SeqRng {
  constructor(private values: number[]) {}

  next(): number {
    return this.values.shift() ?? 0
  }
}

class FakeOrganizationReader implements OrganizationReader {
  constructor(private readonly orgs: Organization[]) {}

  getById(id: string): Organization | null {
    return this.orgs.find((org) => org.id === id) ?? null
  }
}

class FakeAuditLogger implements AuditLogger {
  readonly generations: Array<{ reportId: string; actorId: string }> = []
  readonly failures: Array<{ reason: string; actorId: string }> = []
  readonly shares: Array<{ reportId: string; outcomeCount: number; actorId: string }> = []

  logGeneration(reportId: string, actorId: string): void {
    this.generations.push({ reportId, actorId })
  }

  logFailure(reason: string, actorId: string): void {
    this.failures.push({ reason, actorId })
  }

  logShare(reportId: string, outcomes: ShareOutcome[], actorId: string): void {
    this.shares.push({ reportId, outcomeCount: outcomes.length, actorId })
  }
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const actor: Actor = { id: 'officer-001', role: 'DMC_OFFICIAL' }

const organizations: Organization[] = [
  { id: 'org-1', name: 'World Vision Lanka', type: 'NGO' },
  { id: 'org-2', name: 'Sri Lanka Army', type: 'ARMED_FORCES' },
  { id: 'org-3', name: 'Private Donor Consortium', type: 'PRIVATE_DONOR' },
]

const report: AnalysisReport = {
  id: 'report-1',
  filters: {
    from: new Date('2026-08-01T00:00:00.000Z'),
    to: new Date('2026-08-31T00:00:00.000Z'),
    includedSections: ['ALERTS'],
    language: 'EN',
  },
  sourceCutoff: new Date('2026-09-01T00:00:00.000Z'),
  generatedAt: new Date('2026-09-02T10:00:00.000Z'),
  generatedBy: actor.id,
  metrics: {
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
  },
  warningFlag: true,
}

function buildService(options: { rngValues: number[] }): {
  service: ShareService
  repository: InMemorySnapshotRepository
  shareLog: InMemoryShareLogRepository
  audit: FakeAuditLogger
} {
  const repository = new InMemorySnapshotRepository()
  const shareLog = new InMemoryShareLogRepository()
  const audit = new FakeAuditLogger()

  const service = new ShareService(
    repository,
    shareLog,
    new MockPartnerChannel(new SeqRng(options.rngValues), 0.5),
    new FakeOrganizationReader(organizations),
    audit,
    new FakeClock(new Date('2026-09-03T09:00:00.000Z')),
    new SequentialIdGenerator(),
  )

  return { service, repository, shareLog, audit }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ShareService', () => {
  it("A07.a: 3 orgs, RNG [0.9, 0.1, 0.9] @ 0.5 → ['SENT','FAILED','SENT'], 3 log rows", async () => {
    const { service, repository, shareLog, audit } = buildService({ rngValues: [0.9, 0.1, 0.9] })
    await repository.save(report)

    const outcomes = await service.share('report-1', ['org-1', 'org-2', 'org-3'], actor)

    expect(outcomes.map((outcome) => outcome.status)).toEqual(['SENT', 'FAILED', 'SENT'])
    expect(shareLog.count()).toBe(3)
    // Failure reason recorded on the failed recipient only.
    expect(outcomes[1].failureReason).toContain('Mock delivery failed for Sri Lanka Army')
    expect(outcomes[0].failureReason).toBeUndefined()
    // Organisation names resolved.
    expect(outcomes.map((outcome) => outcome.organizationName)).toEqual([
      'World Vision Lanka',
      'Sri Lanka Army',
      'Private Donor Consortium',
    ])
    expect(audit.shares).toEqual([{ reportId: 'report-1', outcomeCount: 3, actorId: actor.id }])
  })

  it('A07.b: retry same org twice (RNG [0.1, 0.9]) → shareLog.count() === 2 (append-only)', async () => {
    const { service, repository, shareLog } = buildService({ rngValues: [0.1, 0.9] })
    await repository.save(report)

    const first = await service.share('report-1', ['org-1'], actor)
    const second = await service.share('report-1', ['org-1'], actor)

    expect(first[0].status).toBe('FAILED')
    expect(second[0].status).toBe('SENT')
    expect(shareLog.count()).toBe(2)

    // Append-only: two distinct rows for the same report, nothing overwritten.
    const rows = await shareLog.listByReport('report-1')
    expect(rows).toHaveLength(2)
    expect(rows[0].id).not.toBe(rows[1].id)
  })

  it('A07.c: empty org list → throws ValidationError', async () => {
    const { service, repository, shareLog } = buildService({ rngValues: [] })
    await repository.save(report)

    const error = await service.share('report-1', [], actor).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ValidationError)
    expect((error as ValidationError).fields).toEqual(['organizationIds'])
    expect(shareLog.count()).toBe(0)
  })

  it('A07.d: unknown reportId → throws NotFoundError', async () => {
    const { service, shareLog } = buildService({ rngValues: [] })
    // Repository intentionally left empty.

    const error = await service.share('missing-report', ['org-1'], actor).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(NotFoundError)
    expect(shareLog.count()).toBe(0)
  })

  it('A07.e: all failures (RNG [0.1, 0.1, 0.1]) → outcomes all FAILED, shareLog.count() === 3', async () => {
    const { service, repository, shareLog, audit } = buildService({
      rngValues: [0.1, 0.1, 0.1],
    })
    await repository.save(report)

    const outcomes = await service.share('report-1', ['org-1', 'org-2', 'org-3'], actor)

    // The loop continued through every failure (BR9).
    expect(outcomes.map((outcome) => outcome.status)).toEqual(['FAILED', 'FAILED', 'FAILED'])
    expect(shareLog.count()).toBe(3)
    expect(outcomes.every((outcome) => outcome.failureReason !== undefined)).toBe(true)
    expect(audit.shares).toEqual([{ reportId: 'report-1', outcomeCount: 3, actorId: actor.id }])
  })
})
