import type { HazardType } from '@/shared/contracts/types'
import { prisma } from '@/shared/infra/prisma/client'

import type { AnalysisReport } from '../../domain/AnalysisReport'
import { ValidationError } from '../../domain/errors'
import type { SnapshotRepository } from '../SnapshotRepository'
import { toDomainReport, toPrismaReport } from './mappers'

/** Prisma P2002 = unique constraint violated. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'P2002'
  )
}

/**
 * PrismaSnapshotRepository — Prisma implementation of the write-once
 * SnapshotRepository port (DATA_STORE=prisma).
 *
 * Deliberately exposes NO update and NO delete — immutability is enforced by
 * the interface (BR2). Duplicate ids surface as ValidationError (P2002).
 * Prisma is imported only from the shared client module; services and domain
 * never see it.
 */
export class PrismaSnapshotRepository implements SnapshotRepository {
  async save(report: AnalysisReport): Promise<void> {
    try {
      await prisma.analysisReport.create({ data: toPrismaReport(report) })
    } catch (error) {
      if (isUniqueViolation(error)) {
        // Write-once violated: that report id already exists.
        throw new ValidationError(['id'])
      }
      throw error
    }
  }

  async getById(id: string): Promise<AnalysisReport | null> {
    const row = await prisma.analysisReport.findUnique({ where: { id } })
    return row === null ? null : toDomainReport(row)
  }

  async list(query?: {
    limit?: number
    districtId?: string
    hazardType?: HazardType
  }): Promise<AnalysisReport[]> {
    // SQL orders newest-first; districtId/hazardType live inside the JSON
    // `filters` column, so they are filtered in memory (task rule).
    const rows = await prisma.analysisReport.findMany({ orderBy: { generatedAt: 'desc' } })
    let reports = rows.map((row) => toDomainReport(row))

    if (query?.districtId !== undefined) {
      const districtId = query.districtId
      reports = reports.filter((report) => report.filters.districtId === districtId)
    }
    if (query?.hazardType !== undefined) {
      const hazardType = query.hazardType
      reports = reports.filter((report) => report.filters.hazardType === hazardType)
    }
    // Apply the limit AFTER the in-memory filters so `limit` means
    // "N matching reports", not "N rows before filtering".
    if (query?.limit !== undefined) {
      reports = reports.slice(0, Math.max(0, query.limit))
    }

    return reports
  }
}
