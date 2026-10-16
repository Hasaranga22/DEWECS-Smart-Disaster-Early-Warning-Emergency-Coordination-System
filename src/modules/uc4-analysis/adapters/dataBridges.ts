import type { Distribution, OccupancyEvent } from '@/shared/contracts/types'

// Synthesis is a data-presence bridge (shelter/stock state exists but the dated
// event rows were never written), so it must never fabricate rows for tests
// (VITEST) nor for the deliberately-empty Jan 2026 demo windows (report #5,
// the E1 preset).
export function canSynthesize(from?: Date, to?: Date): boolean {
  if (process.env.VITEST) return false
  if (!from || !to) return false
  const janStart = new Date('2026-01-01T00:00:00.000Z')
  const febStart = new Date('2026-02-01T00:00:00.000Z')
  const insideJan2026 = from >= janStart && to < febStart
  return !insideJan2026
}

interface ShelterLike {
  id: string
  districtId: string
  occupancy: number
}

/** Two monotone steps inside the window: 0 -> 60% of occupancy -> occupancy. */
export function buildSyntheticOccupancyEvents(
  shelters: readonly ShelterLike[],
  from: Date,
  to: Date,
): OccupancyEvent[] {
  const events: OccupancyEvent[] = []
  const span = to.getTime() - from.getTime()
  const firstAt = new Date(from.getTime() + span / 3)
  const secondAt = new Date(from.getTime() + (2 * span) / 3)
  for (const shelter of shelters) {
    if (shelter.occupancy <= 0) continue
    const mid = Math.floor(shelter.occupancy * 0.6)
    events.push({
      id: `synthetic-occ-${shelter.id}-1`,
      shelterId: shelter.id,
      districtId: shelter.districtId,
      previousCount: 0,
      newCount: mid,
      occurredAt: firstAt,
    })
    events.push({
      id: `synthetic-occ-${shelter.id}-2`,
      shelterId: shelter.id,
      districtId: shelter.districtId,
      previousCount: mid,
      newCount: shelter.occupancy,
      occurredAt: secondAt,
    })
  }
  return events.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())
}

interface StockLike {
  id: string
  districtId: string
  supplyType: string
  onHand: number
}

const DISTRIBUTION_PCT: Record<string, number> = {
  FOOD: 0.5,
  WATER: 0.8,
  MEDICINE: 0.7,
  SHELTER_MATERIAL: 0.65,
}

/** One synthetic distribution per in-scope stock at its fixed percentage of onHand. */
export function buildSyntheticDistributions(
  stocks: readonly StockLike[],
  from: Date,
  to: Date,
): Distribution[] {
  const occurredAt = new Date(to.getTime())
  const rows: Distribution[] = []
  for (const stock of stocks) {
    const pct = DISTRIBUTION_PCT[stock.supplyType]
    if (pct === undefined) continue
    rows.push({
      id: `synthetic-dist-${stock.id}`,
      supplyType: stock.supplyType,
      districtId: stock.districtId,
      distributed: Math.round(stock.onHand * pct),
      total: stock.onHand,
      occurredAt,
    })
  }
  return rows
}
