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
    for (const orgId of organizationIds) {
      const org = this.organizations.getById(orgId)
      const attemptedAt = this.clock.now()

      // Unknown org → return FAILED outcome without DB save
      // (cannot satisfy NOT NULL FK constraint on report_share.organization_id)
      if (!org) {
        outcomes.push({
          id: this.idGenerator.next(),
          reportId,
          organizationId: orgId,
          status: 'FAILED',
          attemptedAt,
          actorId: actor.id,
          failureReason: 'Unknown organization',
          organizationName: '?',
        })
        continue
      }

      // Known org — existing logic
      let share: ReportShare
      try {
        await this.channel.send(report, org)
        share = {
          id: this.idGenerator.next(),
          reportId,
          organizationId: orgId,
          status: 'SENT',
          attemptedAt,
          actorId: actor.id,
        }
      } catch (err: any) {
        share = {
          id: this.idGenerator.next(),
          reportId,
          organizationId: orgId,
          status: 'FAILED',
          attemptedAt,
          actorId: actor.id,
          failureReason: err.message ?? 'Unknown',
        }
      }

      await this.shareLog.save(share)
      outcomes.push({ ...share, organizationName: org.name })
    }

    // 5. One audit entry for the whole batch.
    this.audit.logShare(reportId, outcomes, actor.id)

    // 6.
    return outcomes
  }
}
