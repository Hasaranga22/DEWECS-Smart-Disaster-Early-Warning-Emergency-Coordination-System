import type {
  AlertReader,
  AttemptReader,
  DistributionReader,
  Filter,
  OccupancyEventReader,
  ReportDecisionReader,
} from '@/shared/contracts/types'

import { AggregationTimeoutError } from '../domain/errors'
import type { Metrics } from '../domain/Metrics'
import type { ReachCalculator } from './ReachCalculator'
import type { ValidatedFilters } from './ReportFilterValidator'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Count rows per key (used for alerts bySeverity / byHazardType). */
function groupCount<T>(rows: readonly T[], keyOf: (row: T) => string): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const row of rows) {
    const key = keyOf(row)
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

const PENDING_STATUSES = new Set(['PENDING_REVIEW', 'NEEDS_INFO'])

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * AggregationService
 *
 * Responsibility: query the 5 dated-event readers in parallel with ONE shared
 * filter (same object, including `sourceCutoff`) and combine their results
 * into a single frozen-ready {@link Metrics} payload.
 *
 * Guarantees:
 * - All readers receive the identical `Filter` → coherent point-in-time
 *   snapshot (BR5).
 * - If any reader misses `deadline`, throws {@link AggregationTimeoutError}
 *   with the elapsed time — NO partial results are ever returned (BR6).
 * - Only reader interfaces are used; no DB access, no Prisma.
 * - `Date.now()` appears only in timeout math.
 */
export class AggregationService {
  constructor(
    private readonly alertReader: AlertReader,
    private readonly attemptReader: AttemptReader,
    private readonly decisionReader: ReportDecisionReader,
    private readonly occupancyReader: OccupancyEventReader,
    private readonly distributionReader: DistributionReader,
    private readonly reachCalculator: ReachCalculator,
  ) {}

  /**
   * Aggregate metrics for the validated filter window.
   *
   * @param filters validated report filters
   * @param sourceCutoff point-in-time cutoff shared by every reader
   * @param deadline absolute time after which aggregation fails
   * @returns combined metrics across all 5 data sources
   * @throws AggregationTimeoutError if the deadline passes first (nothing saved)
   */
  async aggregate(filters: ValidatedFilters, sourceCutoff: Date, deadline: Date): Promise<Metrics> {
    // Step 1: one shared filter object for every reader.
    const sharedFilter: Filter = {
      from: filters.from,
      to: filters.to,
      districtId: filters.districtId,
      hazardType: filters.hazardType,
      cutoff: sourceCutoff,
    }

    // Timeout math (the only permitted Date.now() usage in this service).
    const startMs = Date.now()
    const remainingMs = Math.max(0, deadline.getTime() - startMs)

    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new AggregationTimeoutError(Date.now() - startMs))
      }, remainingMs)
    })

    try {
      // Step 2: 5 parallel reader calls racing the deadline.
      const [alerts, attempts, decisions, occupancyEvents, distributions] = await Promise.race([
        Promise.all([
          this.alertReader.listAlerts(sharedFilter),
          this.attemptReader.listAttempts(sharedFilter),
          this.decisionReader.listDecisions(sharedFilter),
          this.occupancyReader.listEvents(sharedFilter),
          this.distributionReader.listDistributions(sharedFilter),
        ]),
        timeout,
      ])

      // Step 4: combine into Metrics.

      // alerts
      const alertsMetric: Metrics['alerts'] = {
        total: alerts.length,
        bySeverity: groupCount(alerts, (alert) => alert.severity),
        byHazardType: groupCount(alerts, (alert) => alert.hazardType),
      }

      // reach — distinct citizens, per-channel non-additive (BR3/BR4)
      const reach = this.reachCalculator.compute(attempts)

      // reports — pending includes PENDING_REVIEW and NEEDS_INFO
      const reports: Metrics['reports'] = {
        verified: decisions.filter((d) => d.reviewStatus === 'VERIFIED').length,
        rejected: decisions.filter((d) => d.reviewStatus === 'REJECTED').length,
        pending: decisions.filter((d) => PENDING_STATUSES.has(d.reviewStatus)).length,
      }

      // shelters — unique activated shelters, peak cumulative occupancy, sorted events
      const sortedEvents = [...occupancyEvents].sort(
        (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
      )
      const shelters: Metrics['shelters'] = {
        activated: new Set(occupancyEvents.map((event) => event.shelterId)).size,
        peakOccupancy: occupancyEvents.reduce(
          (peak, event) => Math.max(peak, event.newCount),
          0,
        ),
        events: sortedEvents.map((event) => ({
          occurredAt: event.occurredAt,
          shelterId: event.shelterId,
          previousCount: event.previousCount,
          newCount: event.newCount,
        })),
      }

      // supplies — group dated rows by supplyType; zero denominator → null (BR10)
      const byType: Metrics['supplies']['byType'] = {}
      for (const row of distributions) {
        const entry = byType[row.supplyType] ?? { distributed: 0, total: 0, percent: null }
        entry.distributed += row.distributed
        entry.total += row.total
        byType[row.supplyType] = entry
      }
      for (const entry of Object.values(byType)) {
        entry.percent = entry.total > 0 ? Math.round((entry.distributed / entry.total) * 100) : null
      }

      // Step 5: return
      return {
        alerts: alertsMetric,
        reach,
        reports,
        shelters,
        supplies: { byType },
      }
    } finally {
      // Never leave a dangling timer behind (success or timeout path).
      if (timer !== undefined) {
        clearTimeout(timer)
      }
    }
  }
}
