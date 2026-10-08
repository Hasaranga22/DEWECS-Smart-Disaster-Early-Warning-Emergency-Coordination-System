import { prisma } from '@/shared/infra/prisma/client'

import type { ReportShare } from '../../domain/ReportShare'
import { ValidationError } from '../../domain/errors'
import type { ShareLogRepository } from '../ShareLogRepository'
import { toDomainShare } from './mappers'

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
 * PrismaShareLogRepository — Prisma implementation of the append-only
 * ShareLogRepository port (DATA_STORE=prisma).
 *
 * Every attempt (SENT or FAILED) creates a NEW row; retries never update
 * existing rows, preserving the full history (BR8). Prisma is imported only
 * from the shared client module.
 */
export class PrismaShareLogRepository implements ShareLogRepository {
  async save(share: ReportShare): Promise<void> {
    try {
      await prisma.reportShare.create({
        data: {
          id: share.id,
          reportId: share.reportId,
          organizationId: share.organizationId,
          status: share.status,
          attemptedAt: share.attemptedAt,
          actorId: share.actorId,
          failureReason: share.failureReason,
        },
      })
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ValidationError(['id'])
      }
      throw error
    }
  }

  async listByReport(reportId: string): Promise<ReportShare[]> {
    const rows = await prisma.reportShare.findMany({
      where: { reportId },
      orderBy: { attemptedAt: 'asc' },
    })
    return rows.map((row) => toDomainShare(row))
  }

  // No update, no delete — share rows are append-only by design.
}
