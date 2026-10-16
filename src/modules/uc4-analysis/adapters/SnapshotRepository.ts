import type { AnalysisReport } from '../domain/AnalysisReport'
import type { HazardType } from '@/shared/contracts/types'

/**
 * SnapshotRepository — persistence port for immutable AnalysisReport
 * snapshots (docs/uc4-context.md §8.1).
 *
 * Design: save / getById / list ONLY. There is deliberately no update and no
 * delete — write-once immutability is enforced by the interface itself (BR2).
 */
export interface SnapshotRepository {
  /** Write-once: persist a new snapshot. */
  save(report: AnalysisReport): Promise<void>
  /** Fetch one snapshot by id, or null when it does not exist. */
  getById(id: string): Promise<AnalysisReport | null>
  /** List snapshots, newest first. */
  list(query?: {
    limit?: number
    districtId?: string
    hazardType?: HazardType
  }): Promise<AnalysisReport[]>
}
