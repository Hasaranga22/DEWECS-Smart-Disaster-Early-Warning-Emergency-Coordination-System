import type { ShareLogRepository } from '@/modules/uc4-analysis/adapters/ShareLogRepository'
import type { ReportShare } from '@/modules/uc4-analysis/domain/ReportShare'

/**
 * InMemoryShareLogRepository
 *
 * Responsibility: in-memory ShareLogRepository used when DATA_STORE=memory
 * and by tests (no real DB, no Prisma imports).
 *
 * Append-only: `save` pushes a new row — retries create additional rows, so
 * the full attempt history is preserved (BR8). No `Date.now()` inside the
 * repository; timestamps come from the caller's injected Clock.
 */
export class InMemoryShareLogRepository implements ShareLogRepository {
  private readonly rows: ReportShare[] = []

  async save(share: ReportShare): Promise<void> {
    this.rows.push(share)
  }

  async listByReport(reportId: string): Promise<ReportShare[]> {
    return this.rows
      .filter((share) => share.reportId === reportId)
      .sort((a, b) => a.attemptedAt.getTime() - b.attemptedAt.getTime())
  }

  // ─── Test helpers ──────────────────────────────────────────────────────────

  /** Total number of stored share rows across all reports. */
  count(): number {
    return this.rows.length
  }

  /** Remove every stored share row (test isolation only). */
  clear(): void {
    this.rows.length = 0
  }
}
