import { describe, expect, it } from 'vitest'

import type { Actor, AlertReader, HazardAlert } from '@/shared/contracts/types'
import { FakeClock, SequentialIdGenerator } from '@/shared/infra/fakes'
import { InMemorySnapshotRepository } from '@/shared/infra/InMemorySnapshotRepository'

import type { AuditLogger } from '../adapters/AuditLogger'
import { AggregationTimeoutError } from '../domain/errors'
import { AggregationService } from '../services/AggregationService'
import { ReachCalculator } from '../services/ReachCalculator'
import { ReportFilterValidator } from '../services/ReportFilterValidator'
import { SnapshotService } from '../services/SnapshotService'
import {
  FakeAlertReader,
  FakeAttemptReader,
  FakeDecisionReader,
  FakeDistributionReader,
  FakeOccupancyReader,
  SlowReader,
} from './fixtures/fakeReaders'

// ─── Test doubles ─────────────────────────────────────────────────────────────

class FakeAuditLogger implements AuditLogger {
  readonly generations: Array<{ reportId: string; actorId: string }> = []
  readonly failures: Array<{ reason: string; actorId: string }> = []

  logGeneration(reportId: string, actorId: string): void {
    this.generations.push({ reportId, actorId })
  }

  logFailure(reason: string, actorId: string): void {
    this.failures.push({ reason, actorId })
  }
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const actor: Actor = { id: 'officer-001', role: 'DMC_OFFICIAL' }

const districtId = '3f1d3e0a-8f5e-4a2b-9c7d-1e2f3a4b5c6d'

const baseInput = {
  from: '2026-08-01',
  to: '2026-08-31',
  districtId,
  hazardType: 'FLOOD',
  includedSections: ['ALERTS', 'REACH'],
  language: 'EN',
}

const alertOne: HazardAlert = {
  id: 'alert-1',
  hazardType: 'FLOOD',
  severity: 'WATCH',
  districtId,
  occurredAt: new Date('2026-08-02T06:00:00.000Z'),
}

const alertTwo: HazardAlert = {
  id: 'alert-2',
  hazardType: 'FLOOD',
  severity: 'EMERGENCY',
  districtId,
  occurredAt: new Date('2026-08-10T06:00:00.000Z'),
}

function buildService(
  overrides: { alertReader?: AlertReader; clock?: FakeClock } = {},
): {
  service: SnapshotService
  repository: InMemorySnapshotRepository
  audit: FakeAuditLogger
} {
  const repository = new InMemorySnapshotRepository()
  const audit = new FakeAuditLogger()
  const clock = overrides.clock ?? new FakeClock(new Date('2026-09-01T00:00:00.000Z'))
  const alertReader = overrides.alertReader ?? new FakeAlertReader([])

  const aggregation = new AggregationService(
    alertReader,
    new FakeAttemptReader([]),
    new FakeDecisionReader([]),
    new FakeOccupancyReader([]),
    new FakeDistributionReader([]),
    new ReachCalculator(),
  )

  const service = new SnapshotService(
    new ReportFilterValidator(),
    aggregation,
    repository,
    audit,
    clock,
    new SequentialIdGenerator(),
  )

  return { service, repository, audit }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SnapshotService', () => {
  it('A03.c: two generate() calls with different filters → different report IDs; both retrievable', async () => {
    const { service, repository } = buildService()

    const first = await service.generate(baseInput, actor)
    const second = await service.generate({ ...baseInput, hazardType: 'LANDSLIDE' }, actor)

    expect(first.id).not.toBe(second.id)
    expect(first.filters.hazardType).toBe('FLOOD')
    expect(second.filters.hazardType).toBe('LANDSLIDE')
    expect(await repository.getById(first.id)).not.toBeNull()
    expect(await repository.getById(second.id)).not.toBeNull()
    expect(repository.count()).toBe(2)
  })

  it('A04.a: mutating reader data after generate leaves stored metrics unchanged', async () => {
    const alerts: HazardAlert[] = [{ ...alertOne }]
    const { service, repository } = buildService({ alertReader: new FakeAlertReader(alerts) })

    const report = await service.generate(baseInput, actor)
    expect(report.metrics.alerts.total).toBe(1)
    const metricsBefore = JSON.parse(JSON.stringify(report.metrics)) as unknown

    // Mutate the underlying reader state after the snapshot was taken.
    alerts.push(alertTwo)
    alerts[0].severity = 'EMERGENCY'

    const refetched = await repository.getById(report.id)
    expect(refetched).not.toBeNull()
    expect(refetched?.metrics.alerts.total).toBe(1)
    expect(JSON.parse(JSON.stringify(refetched?.metrics))).toEqual(metricsBefore)
  })

  it('A04.b: report is frozen (Object.isFrozen === true)', async () => {
    const { service } = buildService()

    const report = await service.generate(baseInput, actor)

    expect(Object.isFrozen(report)).toBe(true)
  })

  it('A05.a: empty readers → warningFlag === true', async () => {
    const { service } = buildService()

    const report = await service.generate(baseInput, actor)

    expect(report.warningFlag).toBe(true)
  })

  it('A05.b: non-empty readers (at least 1 alert) → warningFlag === false', async () => {
    const { service } = buildService({ alertReader: new FakeAlertReader([{ ...alertOne }]) })

    const report = await service.generate(baseInput, actor)

    expect(report.metrics.alerts.total).toBe(1)
    expect(report.warningFlag).toBe(false)
  })

  it('A06.b: SlowReader + valid input → throws AggregationTimeoutError AND repo.count() === 0', async () => {
    // generate() hardcodes a +60s deadline, so the clock sits in the past:
    // the deadline is already exceeded and the timeout fires immediately,
    // deterministically, without fake timers.
    const { service, repository, audit } = buildService({
      alertReader: new SlowReader(),
      clock: new FakeClock(new Date('2020-01-01T00:00:00.000Z')),
    })

    await expect(service.generate(baseInput, actor)).rejects.toThrow(AggregationTimeoutError)

    // Timeout = nothing saved.
    expect(repository.count()).toBe(0)
    expect(audit.failures).toEqual([{ reason: 'TIMEOUT', actorId: actor.id }])
    expect(audit.generations).toEqual([])
  })
})
