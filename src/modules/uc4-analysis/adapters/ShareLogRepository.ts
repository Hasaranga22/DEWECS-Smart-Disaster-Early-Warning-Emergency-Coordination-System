import type { ReportShare } from '../domain/ReportShare'

/**
 * ShareLogRepository — persistence port for per-recipient share records
 * (docs/uc4-context.md §8.2).
 *
 * Design: append-only — every share attempt (including retries) saves a NEW
 * row; there is no update method, so history is preserved by design (BR8).
 */
export interface ShareLogRepository {
  /** Append one share record (sent or failed). */
  save(share: ReportShare): Promise<void>
  /** All share records for one report, oldest attempt first. */
  listByReport(reportId: string): Promise<ReportShare[]>
}
