import { describe, expect, it } from 'vitest'

import { ReachCalculator } from '../services/ReachCalculator'
import { fakeAttempts } from './fixtures/fakeAttempts'

describe('ReachCalculator', () => {
  const calculator = new ReachCalculator()

  it('A02.a: distinctCitizens === 3 (C001, C002, C004 each have >=1 DELIVERED)', () => {
    const metrics = calculator.compute(fakeAttempts)

    expect(metrics.distinctCitizens).toBe(3)
  })

  it('A02.b: perChannel.PUSH === { attempted: 3, delivered: 2, failed: 1 }', () => {
    const metrics = calculator.compute(fakeAttempts)

    expect(metrics.perChannel.PUSH).toEqual({ attempted: 3, delivered: 2, failed: 1 })
  })

  it('A02.c: perChannel.SMS === { attempted: 4, delivered: 2, failed: 2 }', () => {
    const metrics = calculator.compute(fakeAttempts)

    expect(metrics.perChannel.SMS).toEqual({ attempted: 4, delivered: 2, failed: 2 })
  })

  it('A02.d: empty array → all zeros', () => {
    const metrics = calculator.compute([])

    expect(metrics).toEqual({
      distinctCitizens: 0,
      perChannel: {
        PUSH: { attempted: 0, delivered: 0, failed: 0 },
        SMS: { attempted: 0, delivered: 0, failed: 0 },
      },
    })
  })

  it('A02.f: QUEUED status attempts are counted in attempted but not delivered or failed', () => {
    const queuedAttempts: import('@/shared/contracts/types').NotificationAttempt[] = [
      {
        id: 'q-1',
        citizenId: 'C001',
        channel: 'PUSH',
        deliveryStatus: 'QUEUED',
        occurredAt: new Date('2026-08-01T06:00:00.000Z'),
        districtId: 'district-kelani',
        hazardType: 'FLOOD',
        alertId: 'alert-001',
        attemptAt: new Date('2026-08-01T06:01:00.000Z'),
      },
      {
        id: 'q-2',
        citizenId: 'C001',
        channel: 'SMS',
        deliveryStatus: 'QUEUED',
        occurredAt: new Date('2026-08-01T06:00:00.000Z'),
        districtId: 'district-kelani',
        hazardType: 'FLOOD',
        alertId: 'alert-001',
        attemptAt: new Date('2026-08-01T06:01:00.000Z'),
      },
    ]
    const metrics = calculator.compute(queuedAttempts)

    // QUEUED counts as attempted but neither delivered nor failed
    expect(metrics.distinctCitizens).toBe(0)
    expect(metrics.perChannel.PUSH).toEqual({ attempted: 1, delivered: 0, failed: 0 })
    expect(metrics.perChannel.SMS).toEqual({ attempted: 1, delivered: 0, failed: 0 })
  })

  it('A02.g: SENT status attempts are counted in attempted but not delivered or failed', () => {
    const sentAttempts: import('@/shared/contracts/types').NotificationAttempt[] = [
      {
        id: 's-1',
        citizenId: 'C001',
        channel: 'PUSH',
        deliveryStatus: 'SENT',
        occurredAt: new Date('2026-08-01T06:00:00.000Z'),
        districtId: 'district-kelani',
        hazardType: 'FLOOD',
        alertId: 'alert-001',
        attemptAt: new Date('2026-08-01T06:01:00.000Z'),
      },
    ]
    const metrics = calculator.compute(sentAttempts)

    // SENT counts as attempted but neither delivered nor failed
    expect(metrics.distinctCitizens).toBe(0)
    expect(metrics.perChannel.PUSH).toEqual({ attempted: 1, delivered: 0, failed: 0 })
  })

  it('A02.e: filter only C001\'s two attempts → distinctCitizens === 1 (proves G04 fix)', () => {
    const c001Attempts = fakeAttempts.filter((attempt) => attempt.citizenId === 'C001')
    const metrics = calculator.compute(c001Attempts)

    // One citizen reached on 2 channels still counts once...
    expect(metrics.distinctCitizens).toBe(1)
    // ...even though the non-additive per-channel delivered counts sum to 2.
    expect(metrics.perChannel.PUSH.delivered).toBe(1)
    expect(metrics.perChannel.SMS.delivered).toBe(1)
    expect(metrics.perChannel.PUSH.delivered + metrics.perChannel.SMS.delivered).toBe(2)
  })
})
