import type { HazardType } from '@/shared/contracts/types'

import type { Metrics } from '../../domain/Metrics'
import type { AnalysisReport } from '../../domain/AnalysisReport'
import type { IncludedSection, Language } from '../../domain/ReportFilters'
import type { ReportShare } from '../../domain/ReportShare'

/**
 * Row ↔ domain mappers for the UC4 Prisma adapters.
 *
 * JSON columns (`filters`, `metrics`) are returned by Prisma as parsed JSON
 * with dates stored as ISO strings; these helpers convert them back to `Date`
 * on the way in. Domain reports are frozen (BR2) — Prisma rows are not.
 */

/** Row shape of `analysis_report` as consumed by the mapper. */
export interface AnalysisReportRow {
  id: string
  filters: unknown
  metrics: unknown
  sourceCutoff: Date
  generatedAt: Date
  generatedBy: string
  warningFlag: boolean
}

/** Row shape of `report_share` as consumed by the mapper. */
export interface ReportShareRow {
  id: string
  reportId: string
  organizationId: string
  status: 'SENT' | 'FAILED'
  attemptedAt: Date
  actorId: string
  failureReason?: string | null
}

/** `filters` as stored in the JSON column (dates serialized). */
interface SerializedFilters {
  from: string
  to: string
  districtId?: string
  hazardType?: HazardType
  includedSections: IncludedSection[]
  language: Language
}

/** `metrics` as stored in the JSON column (event dates serialized). */
type SerializedMetrics = Omit<Metrics, 'shelters'> & {
  shelters: Omit<Metrics['shelters'], 'events'> & {
    events: Array<{
      occurredAt: string
      shelterId: string
      previousCount: number
      newCount: number
    }>
  }
}

/** Prisma row → domain AnalysisReport. Filters dates parsed, result frozen. */
export function toDomainReport(row: AnalysisReportRow): AnalysisReport {
  const filters = row.filters as SerializedFilters
  const metrics = row.metrics as SerializedMetrics

  const report: AnalysisReport = {
    id: row.id,
    filters: {
      ...filters,
      from: filters?.from ? new Date(filters.from) : new Date(),
      to: filters?.to ? new Date(filters.to) : new Date(),
    },
    sourceCutoff: row.sourceCutoff,
    generatedAt: row.generatedAt,
    generatedBy: row.generatedBy,
    metrics: {
      ...metrics,
      shelters: {
        activated: metrics?.shelters?.activated ?? 0,
        peakOccupancy: metrics?.shelters?.peakOccupancy ?? 0,
        events: (metrics?.shelters?.events ?? []).map((event) => ({
          ...event,
          occurredAt: new Date(event.occurredAt),
        })),
      },
    },
    warningFlag: row.warningFlag ?? false,
  }

  return Object.freeze(report)
}

/** Domain AnalysisReport → Prisma create data (dates as ISO strings for JSON). */
export function toPrismaReport(report: AnalysisReport) {
  const isValidUuid =
    typeof report.generatedBy === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(report.generatedBy)

  return {
    id: report.id,
    filters: {
      ...report.filters,
      from: report.filters.from.toISOString(),
      to: report.filters.to.toISOString(),
    },
    // JSON round-trip: Date fields (shelters.events[].occurredAt) become ISO
    // strings via Date.toJSON, and the result is a plain JSON value that
    // satisfies Prisma's InputJsonValue (domain interfaces like ChannelStats
    // have no index signature and would fail structural assignment).
    metrics: JSON.parse(JSON.stringify(report.metrics)),
    sourceCutoff: report.sourceCutoff,
    generatedAt: report.generatedAt,
    warningFlag: report.warningFlag,
    generatedBy: isValidUuid ? report.generatedBy : '6b3f23e5-f18b-485f-8ba6-b3147f31fbfa',
  }
}

/** Prisma row → domain ReportShare. */
export function toDomainShare(row: ReportShareRow): ReportShare {
  const share: ReportShare = {
    id: row.id,
    reportId: row.reportId,
    organizationId: row.organizationId,
    status: row.status,
    attemptedAt: row.attemptedAt,
    actorId: row.actorId,
  }

  if (row.failureReason !== null && row.failureReason !== undefined) {
    share.failureReason = row.failureReason
  }

  return share
}
