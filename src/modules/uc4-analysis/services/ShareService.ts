import type { Clock, IdGenerator } from '@/shared/contracts/Clock'
import type { Actor } from '@/shared/contracts/types'

import type { AuditLogger } from '../adapters/AuditLogger'
import type { OrganizationReader, PartnerChannel } from '../adapters/PartnerChannel'
import type { ShareLogRepository } from '../adapters/ShareLogRepository'
import type { SnapshotRepository } from '../adapters/SnapshotRepository'
import type { ReportShare } from '../domain/ReportShare'
import { NotFoundError, ValidationError } from '../domain/errors'
import type { ShareOutcome } from '../domain/ShareOutcome'

/**
 * ShareService
 *
 * Responsibility: deliver a saved AnalysisReport snapshot to partner
 * organisations, logging one row per recipient (UC4 §6.6).
 *
 * Guarantees:
 * - One failure does NOT stop the loop — every recipient gets its own
 *   outcome, and the report stays valid regardless (BR8 / BR9).
 * - Every attempt (SENT or FAILED) appends a new ShareLog row; existing
 *   rows are never updated, so retries preserve history (BR8).
 * - Unknown recipients become FAILED outcomes with organizationName '?'.
 * - Clock and IdGenerator are injected — no `new Date()` / `randomUUID()`.
 */
export class ShareService {
  constructor(
    private readonly repository: SnapshotRepository,
    private readonly shareLog: ShareLogRepository,
    private readonly channel: PartnerChannel,
    private readonly organizations: OrganizationReader,
    private readonly audit: AuditLogger,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
  ) {}

  /**
   * Share one report with the given organisations.
   *
   * @param reportId snapshot to share
   * @param organizationIds at least one recipient
   * @param actor the DMC Official performing the share
   * @returns one outcome per recipient, in request order
   * @throws NotFoundError when the report does not exist
   * @throws ValidationError when organizationIds is empty (API 400)
   */
  async share(
    reportId: string,
    organizationIds: string[],
    actor: Actor,
  ): Promise<ShareOutcome[]> {
    // 1. The snapshot must exist — sharing never regenerates it.
    const report = await this.repository.getById(reportId)
    if (report === null) {
      throw new NotFoundError('Analysis report', reportId)
    }

    // 2. At least one recipient.
    if (organizationIds.length === 0) {
      throw new ValidationError(['organizationIds'])
    }

    // 3.
    const outcomes: ShareOutcome[] = []

    // 4. One recipient at a time — individual failures never break the batch.
    for (const organizationId of organizationIds) {
      const organization = this.organizations.getById(organizationId)
      const attemptedAt = this.clock.now()

      let status: ReportShare['status']
      let failureReason: string | undefined
      try {
        if (organization === null) {
          throw new Error('Unknown')
        }
        await this.channel.send(report, organization)
        status = 'SENT'
      } catch (error) {
        status = 'FAILED'
        failureReason = error instanceof Error ? error.message : String(error)
      }

      // ALWAYS save — success and failure alike (append-only history).
      const row: ReportShare = {
        id: this.idGenerator.next(),
        reportId,
        organizationId,
        status,
        attemptedAt,
        actorId: actor.id,
      }
      if (failureReason !== undefined) {
        row.failureReason = failureReason
      }
      await this.shareLog.save(row)

      outcomes.push({ ...row, organizationName: organization?.name ?? '?' })
    }

    // 5. One audit entry for the whole batch.
    this.audit.logShare(reportId, outcomes, actor.id)

    // 6.
    return outcomes
  }
}
