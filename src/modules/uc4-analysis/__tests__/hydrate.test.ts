import { afterEach, describe, expect, it } from 'vitest'

import type { Metrics } from '../domain/Metrics'
import { isAllZeroMetrics, shouldHydrateReport } from '../seed/ensureUc4SampleData'

const zeroMetrics: Metrics = {
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

const report = (from: string, to: string, metrics: Metrics) => ({
  filters: {
    from: new Date(from),
    to: new Date(to),
    includedSections: ['ALERTS'] as Array<'ALERTS'>,
    language: 'EN' as const,
  },
  metrics,
})

afterEach(() => {
  process.env.VITEST = 'true'
})

describe('isAllZeroMetrics', () => {
  it('accepts fully empty metrics', () => {
    expect(isAllZeroMetrics(zeroMetrics)).toBe(true)
  })

  it('rejects any non-zero headline metric', () => {
    expect(isAllZeroMetrics({ ...zeroMetrics, alerts: { ...zeroMetrics.alerts, total: 3 } })).toBe(false)
    expect(
      isAllZeroMetrics({ ...zeroMetrics, reports: { verified: 1, rejected: 0, pending: 0 } }),
    ).toBe(false)
    expect(
      isAllZeroMetrics({
        ...zeroMetrics,
        supplies: { byType: { FOOD: { distributed: 1, total: 2, percent: 50 } } },
      }),
    ).toBe(false)
  })
})

describe('shouldHydrateReport', () => {
  it('is true for an all-zero report in a normal window (outside vitest)', () => {
    delete process.env.VITEST
    expect(shouldHydrateReport(report('2026-08-01T00:00:00Z', '2026-08-31T00:00:00Z', zeroMetrics))).toBe(true)
  })

  it('is false under vitest (tests never hydrate fixtures)', () => {
    process.env.VITEST = 'true'
    expect(shouldHydrateReport(report('2026-08-01T00:00:00Z', '2026-08-31T00:00:00Z', zeroMetrics))).toBe(false)
  })

  it('is false for the Jan 2026 empty-period demo windows', () => {
    delete process.env.VITEST
    expect(shouldHydrateReport(report('2026-01-01T00:00:00Z', '2026-01-31T00:00:00Z', zeroMetrics))).toBe(false)
  })

  it('is false when metrics are already populated', () => {
    delete process.env.VITEST
    const populated: Metrics = { ...zeroMetrics, alerts: { total: 2, bySeverity: {}, byHazardType: {} } }
    expect(shouldHydrateReport(report('2026-08-01T00:00:00Z', '2026-08-31T00:00:00Z', populated))).toBe(false)
  })
})
