import { prisma } from '@/shared/infra/prisma/client'

import type { ReportShare } from '../../domain/ReportShare'
import { ValidationError } from '../../domain/errors'
import type { ShareLogRepository } from '../ShareLogRepository'
import { toDomainShare } from './mappers'

/** Seeded "DMC Official" (prisma/seed.ts) — actor fallback for the Officer FK. */
const FALLBACK_ACTOR_ID = '00000000-0000-4000-8000-000000000888'

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
    const isUuid =
      typeof share.actorId === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(share.actorId)
    const candidate = isUuid ? share.actorId : FALLBACK_ACTOR_ID

    // actor_id is a real Officer FK. Session/demo actor ids live in a
    // different id space than the Officer table, so resolve the FK here at
    // the DB boundary: missing officer -> seeded DMC fallback (same id the
    // non-uuid path already used).
    const officer = await prisma.officer.findUnique({
      where: { id: candidate },
      select: { id: true },
    })
    const actorId = officer === null ? FALLBACK_ACTOR_ID : candidate

    try {
      await prisma.reportShare.create({
        data: {
          id: share.id,
          reportId: share.reportId,
          organizationId: share.organizationId,
          status: share.status,
          attemptedAt: share.attemptedAt,
          actorId,
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
