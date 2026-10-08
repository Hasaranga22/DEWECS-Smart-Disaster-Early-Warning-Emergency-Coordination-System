import type { HazardType } from '@/shared/contracts/types'
import type { SnapshotRepository } from '@/modules/uc4-analysis/adapters/SnapshotRepository'
import type { AnalysisReport } from '@/modules/uc4-analysis/domain/AnalysisReport'
import { DuplicateSnapshotError } from '@/modules/uc4-analysis/domain/errors'

/**
 * InMemorySnapshotRepository
 *
 * Responsibility: in-memory SnapshotRepository used when DATA_STORE=memory
 * and by tests (no real DB). Enforces write-once semantics: saving an id that
 * already exists throws DuplicateSnapshotError — reports are never updated
 * or deleted (BR2).
 */
export class InMemorySnapshotRepository implements SnapshotRepository {
  private readonly store = new Map<string, AnalysisReport>()

  async save(report: AnalysisReport): Promise<void> {
    if (this.store.has(report.id)) {
      throw new DuplicateSnapshotError(report.id)
    }
    this.store.set(report.id, report)
  }

  async getById(id: string): Promise<AnalysisReport | null> {
    return this.store.get(id) ?? null
  }

  async list(query?: {
    limit?: number
    districtId?: string
    hazardType?: HazardType
  }): Promise<AnalysisReport[]> {
    let reports = [...this.store.values()]

    if (query?.districtId !== undefined) {
      reports = reports.filter((report) => report.filters.districtId === query.districtId)
    }
    if (query?.hazardType !== undefined) {
      reports = reports.filter((report) => report.filters.hazardType === query.hazardType)
    }

    // Newest first (generatedAt desc).
    reports.sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime())

    if (query?.limit !== undefined) {
      reports = reports.slice(0, Math.max(0, query.limit))
    }

    return reports
  }

  // ─── Test helpers ──────────────────────────────────────────────────────────

  /** Number of stored snapshots. */
  count(): number {
    return this.store.size
  }

  /** Remove every stored snapshot (test isolation only). */
  clear(): void {
    this.store.clear()
  }
}
