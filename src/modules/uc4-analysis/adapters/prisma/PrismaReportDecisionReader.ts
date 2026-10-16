import { prisma } from '@/shared/infra/prisma/client'
import type {
  Filter,
  HazardType,
  ReportDecision,
  ReportDecisionReader,
  ReviewStatus,
} from '@/shared/contracts/types'
import type { Prisma } from '@/generated/prisma/client'
import { expandDistrictIds } from '../districtAliases'

// CLARIFIED puts the report back in the queue (PENDING_REVIEW); RESOLVED and
// EXTENDED are lifecycle events, not decisions — they are filtered out so
// verified reports are never double-counted (same rule as DecisionQueryService).
const ACTION_TO_STATUS: Record<string, ReviewStatus> = {
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
  NEEDS_INFO: 'NEEDS_INFO',
  CLARIFIED: 'PENDING_REVIEW',
}

/**
 * Audit-backed decisions UNION ground reports that never got an audit entry
 * (a never-reviewed report must still tally as PENDING). Reports having any
 * audit row are represented by that row only, so nothing double-counts.
 */
export class PrismaReportDecisionReader implements ReportDecisionReader {
  async listDecisions(filter: Filter): Promise<ReportDecision[]> {
    const auditClauses: Prisma.ReportAuditEntryWhereInput[] = []
    const reportClauses: Prisma.GroundReportWhereInput[] = []

    if (filter.from || filter.to) {
      const occurredRange = {
        ...(filter.from ? { gte: filter.from } : {}),
        ...(filter.to ? { lte: filter.to } : {}),
      }
      auditClauses.push({ occurredAt: occurredRange })
      reportClauses.push({ captureTime: occurredRange })
    }
    if (filter.cutoff) {
      auditClauses.push({ occurredAt: { lte: filter.cutoff } })
      reportClauses.push({ captureTime: { lte: filter.cutoff } })
    }
    if (filter.districtId !== undefined) {
      const ids = { in: expandDistrictIds(filter.districtId) }
      auditClauses.push({ districtId: ids })
      reportClauses.push({ districtId: ids })
    }
    if (filter.hazardType !== undefined) {
      auditClauses.push({ hazardType: filter.hazardType })
      reportClauses.push({ hazardType: filter.hazardType })
    }

    const audits = await prisma.reportAuditEntry.findMany({
      where: auditClauses.length > 0 ? { AND: auditClauses } : {},
      orderBy: { occurredAt: 'asc' },
    })

    const reports = await prisma.groundReport.findMany({
      where: {
        AND: [
          ...(reportClauses.length > 0 ? reportClauses : []),
          { auditEntries: { none: {} } },
        ],
      },
      orderBy: { captureTime: 'asc' },
    })

    const decisions: ReportDecision[] = []
    for (const entry of audits) {
      const reviewStatus = ACTION_TO_STATUS[entry.action]
      if (!reviewStatus) continue
      decisions.push({
        id: entry.id,
        reportId: entry.reportId,
        districtId: entry.districtId,
        hazardType: entry.hazardType as HazardType,
        reviewStatus,
        occurredAt: entry.occurredAt,
        officerId: entry.officerId ?? undefined,
        reason: entry.reason ?? undefined,
      })
    }
    for (const report of reports) {
      decisions.push({
        id: report.id,
        reportId: report.id,
        districtId: report.districtId,
        hazardType: report.hazardType as HazardType,
        reviewStatus: report.reviewStatus as ReviewStatus,
        occurredAt: report.captureTime,
      })
    }
    return decisions.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())
  }
}
