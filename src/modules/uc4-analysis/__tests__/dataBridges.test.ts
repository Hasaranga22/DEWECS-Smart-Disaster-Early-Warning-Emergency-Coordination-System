import { describe, expect, it, afterEach } from 'vitest'

import {
  buildSyntheticDistributions,
  buildSyntheticOccupancyEvents,
  canSynthesize,
} from '../adapters/dataBridges'

const FROM = new Date('2026-09-01T00:00:00.000Z')
const TO = new Date('2026-09-30T23:59:59.999Z')

afterEach(() => {
  process.env.VITEST = 'true'
})

describe('canSynthesize', () => {
  it('is false under vitest (guards keep tests on real data only)', () => {
    process.env.VITEST = 'true'
    expect(canSynthesize(FROM, TO)).toBe(false)
  })

  it('is false without a full window', () => {
    delete process.env.VITEST
    expect(canSynthesize(undefined, TO)).toBe(false)
    expect(canSynthesize(FROM, undefined)).toBe(false)
  })

  it('refuses windows inside Jan 2026 (empty-period demos stay empty)', () => {
    delete process.env.VITEST
    expect(canSynthesize(new Date('2026-01-01T00:00:00Z'), new Date('2026-01-31T23:59:59Z'))).toBe(false)
    expect(canSynthesize(new Date('2026-01-15T00:00:00Z'), new Date('2026-01-16T00:00:00Z'))).toBe(false)
  })

  it('allows a normal window outside Jan 2026', () => {
    delete process.env.VITEST
    expect(canSynthesize(FROM, TO)).toBe(true)
    // windows crossing out of January are allowed too
    expect(canSynthesize(new Date('2026-01-15T00:00:00Z'), new Date('2026-02-15T00:00:00Z'))).toBe(true)
  })
})

describe('buildSyntheticOccupancyEvents', () => {
  it('emits two in-window steps per shelter: 0 -> floor(60%) -> occupancy', () => {
    const events = buildSyntheticOccupancyEvents(
      [
        { id: 's1', districtId: 'd1', occupancy: 50 },
        { id: 's2', districtId: 'd1', occupancy: 100 },
      ],
      FROM,
      TO,
    )
    expect(events).toHaveLength(4)
    // time-sorted, so both step-1 events precede both step-2 events
    expect(events.map((e) => [e.previousCount, e.newCount])).toEqual([
      [0, 30],
      [0, 60],
      [30, 50],
      [60, 100],
    ])
    expect(events.every((e) => e.occurredAt >= FROM && e.occurredAt <= TO)).toBe(true)
    expect(events.every((e) => e.shelterId === 's1' || e.shelterId === 's2')).toBe(true)
    expect(new Set(events.map((e) => e.id)).size).toBe(4)
  })

  it('skips shelters with zero occupancy', () => {
    const events = buildSyntheticOccupancyEvents(
      [
        { id: 's1', districtId: 'd1', occupancy: 0 },
        { id: 's2', districtId: 'd1', occupancy: 10 },
      ],
      FROM,
      TO,
    )
    expect(events).toHaveLength(2)
    expect(events.every((e) => e.shelterId === 's2')).toBe(true)
  })

  it('returns events sorted by time', () => {
    const events = buildSyntheticOccupancyEvents(
      [
        { id: 's1', districtId: 'd1', occupancy: 42 },
        { id: 's2', districtId: 'd2', occupancy: 7 },
      ],
      FROM,
      TO,
    )
    const times = events.map((e) => e.occurredAt.getTime())
    expect([...times].sort((a, b) => a - b)).toEqual(times)
  })
})

describe('buildSyntheticDistributions', () => {
  it('uses the fixed percentages: FOOD 50, WATER 80, MEDICINE 70, SHELTER_MATERIAL 65', () => {
    const rows = buildSyntheticDistributions(
      [
        { id: 'st1', districtId: 'd1', supplyType: 'FOOD', onHand: 1000 },
        { id: 'st2', districtId: 'd1', supplyType: 'WATER', onHand: 100 },
        { id: 'st3', districtId: 'd1', supplyType: 'MEDICINE', onHand: 100 },
        { id: 'st4', districtId: 'd1', supplyType: 'SHELTER_MATERIAL', onHand: 200 },
      ],
      FROM,
      TO,
    )
    expect(rows.map((r) => [r.supplyType, r.distributed, r.total])).toEqual([
      ['FOOD', 500, 1000],
      ['WATER', 80, 100],
      ['MEDICINE', 70, 100],
      ['SHELTER_MATERIAL', 130, 200],
    ])
    expect(rows.every((r) => r.occurredAt >= FROM && r.occurredAt <= TO)).toBe(true)
  })

  it('skips supply types without a fixed percentage', () => {
    const rows = buildSyntheticDistributions(
      [{ id: 'st1', districtId: 'd1', supplyType: 'Food Rations (Packs)', onHand: 500 }],
      FROM,
      TO,
    )
    expect(rows).toEqual([])
  })
})
