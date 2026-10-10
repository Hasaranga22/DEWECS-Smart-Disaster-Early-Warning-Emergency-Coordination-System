import type { ReportFilters } from './ReportFilters'
import type { Metrics } from './Metrics'

export interface AnalysisReport {
  readonly id: string
  readonly filters: ReportFilters
  readonly sourceCutoff: Date
  readonly generatedAt: Date
  readonly generatedBy: string
  readonly metrics: Metrics
  readonly warningFlag: boolean
}
