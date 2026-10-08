import { describe, expect, it, vi } from 'vitest'

import type { Filter } from '@/shared/contracts/types'

import { AggregationTimeoutError } from '../domain/errors'
import { AggregationService } from '../services/AggregationService'
import { ReachCalculator } from '../services/ReachCalculator'
import type { ValidatedFilters } from '../services/ReportFilterValidator'
import {
  FakeAlertReader,
  FakeAttemptReader,
  FakeDecisionReader,
  FakeDistributionReader,
  FakeOccupancyReader,
  SlowReader,
} from './fixtures/fakeReaders'

const filters: ValidatedFilters = {
  from: new Date('2026-08-01T00:00:00.000Z'),
  to: new Date('2026-08-31T23:59:59.999Z'),
  districtId: 'district-kelani',
  hazardType: 'FLOOD',
  includedSections: ['ALERTS', 'REACH', 'REPORTS', 'SHELTERS', 'SUPPLIES'],
  language: 'EN',
}

const sourceCutoff = new Date('2026-09-01T00:00:00.000Z')

/** Far-future deadline so only real timeouts fail a test. */
const farDeadline = (): Date => new Date(Date.now() + 30_000)

function buildService(overrides: {
  alertReader?: FakeAlertReader | SlowReader
  distributionReader?: FakeDistributionReader
} = {}): {
  service: AggregationService
  alertReader: FakeAlertReader | SlowReader
  distributionReader: FakeDistributionReader
} {
  const alertReader = overrides.alertReader ?? new FakeAlertReader([])
  const distributionReader = overrides.distributionReader ?? new FakeDistributionReader([])
  const service = new AggregationService(
    alertReader,
    new FakeAttemptReader([]),
    new FakeDecisionReader([]),
    new FakeOccupancyReader([]),
    distributionReader,
    new ReachCalculator(),
  )
  return { service, alertReader, distributionReader }
}

describe('AggregationService', () => {
  it('A03.a: passes the same Filter object (with .cutoff) to every reader', async () => {
    const alertReader = new FakeAlertReader([])
    const attemptReader = new FakeAttemptReader([])
    const decisionReader = new FakeDecisionReader([])
    const occupancyReader = new FakeOccupancyReader([])
    const distributionReader = new FakeDistributionReader([])
    const service = new AggregationService(
      alertReader,
      attemptReader,
      decisionReader,
      occupancyReader,
      distributionReader,
      new ReachCalculator(),
    )

    const alertSpy = vi.spyOn(alertReader, 'listAlerts')
    const attemptSpy = vi.spyOn(attemptReader, 'listAttempts')
    const decisionSpy = vi.spyOn(decisionReader, 'listDecisions')
    const occupancySpy = vi.spyOn(occupancyReader, 'listEvents')
    const distributionSpy = vi.spyOn(distributionReader, 'listDistributions')

    await service.aggregate(filters, sourceCutoff, farDeadline())

    const expected: Filter = {
      from: filters.from,
      to: filters.to,
      districtId: 'district-kelani',
      hazardType: 'FLOOD',
      cutoff: sourceCutoff,
    }

    const spies = [alertSpy, attemptSpy, decisionSpy, occupancySpy, distributionSpy]
    for (const spy of spies) {
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy.mock.calls[0][0]).toEqual(expected)
    }

    // Identical reference — literally the SAME shared filter object.
    const first = alertSpy.mock.calls[0][0]
    for (const spy of spies) {
      expect(spy.mock.calls[0][0]).toBe(first)
    }
  })

  it('A06.a: SlowReader as alertReader + 50ms deadline → throws AggregationTimeoutError', async () => {
    const { service } = buildService({ alertReader: new SlowReader() })

    const deadline = new Date(Date.now() + 50)

    await expect(service.aggregate(filters, sourceCutoff, deadline)).rejects.toThrow(
      AggregationTimeoutError,
    )
  })

  it('A08.a: distribution with total === 0 → supplies.byType[type].percent === null', async () => {
    const distributionReader = new FakeDistributionReader([
      {
        id: 'distribution-001',
        supplyType: 'FOOD',
        districtId: 'district-kelani',
        distributed: 40,
        total: 0,
        occurredAt: new Date('2026-08-05T09:00:00.000Z'),
      },
    ])
    const { service } = buildService({ distributionReader })

    const metrics = await service.aggregate(filters, sourceCutoff, farDeadline())

    expect(metrics.supplies.byType['FOOD']).toEqual({ distributed: 40, total: 0, percent: null })
  })

  it('A08.b: distribution with delivered === total → percent === 100', async () => {
    // Two dated rows: sums must be used (100/100), not per-row averaging.
    const distributionReader = new FakeDistributionReader([
      {
        id: 'distribution-002',
        supplyType: 'WATER',
        districtId: 'district-kelani',
        distributed: 30,
        total: 30,
        occurredAt: new Date('2026-08-06T09:00:00.000Z'),
      },
      {
        id: 'distribution-003',
        supplyType: 'WATER',
        districtId: 'district-kelani',
        distributed: 70,
        total: 70,
        occurredAt: new Date('2026-08-07T09:00:00.000Z'),
      },
    ])
    const { service } = buildService({ distributionReader })

    const metrics = await service.aggregate(filters, sourceCutoff, farDeadline())

    expect(metrics.supplies.byType['WATER']).toEqual({ distributed: 100, total: 100, percent: 100 })
  })
})
