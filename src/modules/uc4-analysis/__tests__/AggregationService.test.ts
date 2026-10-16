import { describe, expect, it, vi } from 'vitest'

import type { Distribution, Filter } from '@/shared/contracts/types'

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
  FakeSupplyStockReader,
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
  supplyStockReader?: FakeSupplyStockReader
} = {}): {
  service: AggregationService
  alertReader: FakeAlertReader | SlowReader
  distributionReader: FakeDistributionReader
  supplyStockReader: FakeSupplyStockReader
} {
  const alertReader = overrides.alertReader ?? new FakeAlertReader([])
  const distributionReader = overrides.distributionReader ?? new FakeDistributionReader([])
  const supplyStockReader = overrides.supplyStockReader ?? new FakeSupplyStockReader([])
  const service = new AggregationService(
    alertReader,
    new FakeAttemptReader([]),
    new FakeDecisionReader([]),
    new FakeOccupancyReader([]),
    distributionReader,
    supplyStockReader,
    new ReachCalculator(),
  )
  return { service, alertReader, distributionReader, supplyStockReader }
}

describe('AggregationService', () => {
  it('A03.a: passes the same Filter object (with .cutoff) to every reader', async () => {
    const alertReader = new FakeAlertReader([])
    const attemptReader = new FakeAttemptReader([])
    const decisionReader = new FakeDecisionReader([])
    const occupancyReader = new FakeOccupancyReader([])
    const distributionReader = new FakeDistributionReader([])
    const supplyStockReader = new FakeSupplyStockReader([])
    const service = new AggregationService(
      alertReader,
      attemptReader,
      decisionReader,
      occupancyReader,
      distributionReader,
      supplyStockReader,
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

  it('A08.a: distribution with no stock → supplies.byType[type].percent === null', async () => {
    // No supply stock for this type → total = 0 → percent = null (BR10)
    const distributionReader = new FakeDistributionReader([
      {
        id: 'distribution-001',
        supplyType: 'FOOD',
        districtId: 'district-kelani',
        distributed: 40,
        total: 100,
        occurredAt: new Date('2026-08-05T09:00:00.000Z'),
      },
    ])
    const supplyStockReader = new FakeSupplyStockReader([])
    const service = new AggregationService(
      new FakeAlertReader([]),
      new FakeAttemptReader([]),
      new FakeDecisionReader([]),
      new FakeOccupancyReader([]),
      distributionReader,
      supplyStockReader,
      new ReachCalculator(),
    )

    const metrics = await service.aggregate(filters, sourceCutoff, farDeadline())

    expect(metrics.supplies.byType['FOOD']).toEqual({ distributed: 40, total: 0, percent: null })
  })

  it('A08.b: distribution with sum equals onHand → percent === 100', async () => {
    // Supply stock: 100 on hand; two distributions summing to 100 → 100%
    const fakeStocks = [
      { id: 's1', organizationId: 'o1', districtId: 'd1', supplyType: 'WATER', onHand: 100, updatedAt: new Date() },
    ]
    const fakeDistributions = [
      { id: 'd1', supplyType: 'WATER', districtId: 'd1', distributed: 30, total: 100, occurredAt: new Date(), organizationId: 'o1' } as any,
      { id: 'd2', supplyType: 'WATER', districtId: 'd1', distributed: 70, total: 100, occurredAt: new Date(), organizationId: 'o1' } as any,
    ]
    const { service } = buildService({
      distributionReader: new FakeDistributionReader(fakeDistributions),
      supplyStockReader: new FakeSupplyStockReader(fakeStocks),
    })

    const metrics = await service.aggregate(filters, sourceCutoff, farDeadline())

    expect(metrics.supplies.byType['WATER']).toEqual({ distributed: 100, total: 100, percent: 100 })
  })

  it('A08.c: FOOD with stock 10000 and 2 distributions summing to 5000 → percent 50', async () => {
    const fakeStocks = [
      { id: 's1', organizationId: 'o1', districtId: 'd1', supplyType: 'FOOD', onHand: 10000, updatedAt: new Date() },
    ]
    const fakeDistributions: Distribution[] = [
      { id: 'd1', supplyType: 'FOOD', districtId: 'd1', distributed: 3000, total: 10000, occurredAt: new Date() },
      { id: 'd2', supplyType: 'FOOD', districtId: 'd1', distributed: 2000, total: 10000, occurredAt: new Date() },
    ]
    const { service } = buildService({
      distributionReader: new FakeDistributionReader(fakeDistributions),
      supplyStockReader: new FakeSupplyStockReader(fakeStocks),
    })

    const metrics = await service.aggregate(filters, sourceCutoff, farDeadline())

    expect(metrics.supplies.byType['FOOD'].distributed).toBe(5000)
    expect(metrics.supplies.byType['FOOD'].total).toBe(10000)
    expect(metrics.supplies.byType['FOOD'].percent).toBe(50)
  })
})
