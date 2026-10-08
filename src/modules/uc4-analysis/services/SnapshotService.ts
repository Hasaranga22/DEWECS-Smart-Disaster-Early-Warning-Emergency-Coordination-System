import type { Clock, IdGenerator } from '@/shared/contracts/Clock'
import type { Actor } from '@/shared/contracts/types'

import type { AuditLogger } from '../adapters/AuditLogger'
import type { SnapshotRepository } from '../adapters/SnapshotRepository'
import type { AnalysisReport } from '../domain/AnalysisReport'
import { AggregationTimeoutError } from '../domain/errors'
import type { Metrics } from '../domain/Metrics'
import type { AggregationService } from './AggregationService'
import type { ReportFilterValidator } from './ReportFilterValidator'

/** Aggregation budget for one report (docs/uc4-context.md §6.4). */
const AGGREGATION_TIMEOUT_MS = 60_000

/**
 * Zero-activity check: every headline metric is empty AND no supplies were
 * distributed. Alerts, distinct citizens, report tallies and activated
 * shelters must ALL be zero; supplies must have no grouped rows (BR7).
 */
function isAllZero(metrics: Metrics): boolean {
  return (
    metrics.alerts.total === 0 &&
    metrics.reach.distinctCitizens === 0 &&
    metrics.reports.verified === 0 &&
    metrics.reports.rejected === 0 &&
    metrics.reports.pending === 0 &&
    metrics.shelters.activated === 0 &&
    Object.keys(metrics.supplies.byType).length === 0
  )
}

/**
 * SnapshotService
 *
 * Responsibility: generate a point-in-time, immutable AnalysisReport (UC4).
 *
 * Guarantees:
 * - Filters are validated first — a ValidationError means nothing ran.
 * - Timeout = no save: if aggregation misses the deadline, the
 *   AggregationTimeoutError is rethrown (after auditing) and the repository
 *   is never touched — count stays unchanged (BR6).
 * - Empty data is valid: a zero-activity report is persisted with
 *   warningFlag = true (BR7 / E1).
 * - The report is Object.freeze'd and write-once (BR2).
 * - Clock and IdGenerator are injected — no `new Date()` / `randomUUID()`.
 */
export class SnapshotService {
  constructor(
    private readonly validator: ReportFilterValidator,
    private readonly aggregation: AggregationService,
    private readonly repository: SnapshotRepository,
    private readonly audit: AuditLogger,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
  ) {}

  /**
   * Generate a report snapshot from raw filter input.
   *
   * @param input untrusted filter input (API body / query params / UI state)
   * @param actor the DMC Official requesting the report
   * @returns the frozen, persisted AnalysisReport
   * @throws ValidationError when filters are invalid
   * @throws AggregationTimeoutError when aggregation misses the deadline
   *         (nothing is saved)
   */
  async generate(input: unknown, actor: Actor): Promise<AnalysisReport> {
    // 1. Validate filters — may throw ValidationError before any side effect.
    const filters = this.validator.validate(input)

    // 2. Source cutoff marks the point in time this snapshot represents.
    const sourceCutoff = this.clock.now()

    // 3. Aggregation deadline: 60s after the cutoff.
    const deadline = new Date(sourceCutoff.getTime() + AGGREGATION_TIMEOUT_MS)

    // 4. Aggregate. On timeout: audit and rethrow — DO NOT save.
    let metrics: Metrics
    try {
      metrics = await this.aggregation.aggregate(filters, sourceCutoff, deadline)
    } catch (error) {
      if (error instanceof AggregationTimeoutError) {
        this.audit.logFailure('TIMEOUT', actor.id)
      }
      throw error
    }

    // 5. Zero-activity period is still a valid report.
    const warningFlag = isAllZero(metrics)

    // 6. Build the immutable snapshot.
    const report: AnalysisReport = Object.freeze({
      id: this.idGenerator.next(),
      filters,
      sourceCutoff,
      generatedAt: this.clock.now(),
      generatedBy: actor.id,
      metrics,
      warningFlag,
    })

    // 7. Write-once persistence (skipped entirely on timeout).
    await this.repository.save(report)

    // 8. Audit only after a successful save.
    this.audit.logGeneration(report.id, actor.id)

    // 9. Return the frozen report.
    return report
  }
}
