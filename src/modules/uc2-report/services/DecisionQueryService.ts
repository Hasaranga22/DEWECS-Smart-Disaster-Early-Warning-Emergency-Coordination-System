import { AuditRepository, ReportAuditEntry } from "./ReviewService";
import { HazardType } from "@/shared/contracts/types";
import { ReviewStatus } from "../domain/GroundReport";

// ─── Shared Contract Filter Type ──────────────────────────────────────────────

export interface ReportDecisionFilter {
  from?: Date;
  to?: Date;
  districtId?: string;
  hazardType?: HazardType;
  cutoff?: Date;
}

/** Exported via shared contracts — UC4 reads this for post-event analysis metrics. */
export interface ReportDecision {
  id: string;
  reportId: string;
  districtId: string;
  hazardType: HazardType;
  reviewStatus: ReviewStatus;
  occurredAt: Date;
  officerId?: string;
  reason?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * DecisionQueryService
 *
 * Responsibility: Implement the ReportDecisionReader contract for UC4.
 *
 * UC4 uses this to count:
 *   - How many reports were VERIFIED vs REJECTED vs PENDING in a time range.
 *   - Which officers processed the most reports.
 *   - Ground report tally by district and hazard type.
 *
 * The `cutoff` filter (from the shared contract) means: ignore any decisions
 * recorded AFTER this timestamp (used for frozen snapshot analysis in UC4).
 */
export class DecisionQueryService {
  constructor(private readonly audits: AuditRepository) {}

  /**
   * List audit decisions applying the requested filters.
   * UC4 calls this during report generation.
   */
  async listDecisions(filter: ReportDecisionFilter): Promise<ReportDecision[]> {
    const entries = await this.audits.findAll();

    return entries
      .filter((entry) => this.matchesFilter(entry, filter))
      .map((entry) => this.toDecision(entry));
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private matchesFilter(
    entry: ReportAuditEntry,
    filter: ReportDecisionFilter
  ): boolean {
    if (filter.from && entry.occurredAt < filter.from) return false;
    if (filter.to && entry.occurredAt > filter.to) return false;
    if (filter.cutoff && entry.occurredAt > filter.cutoff) return false;
    if (filter.districtId && entry.districtId !== filter.districtId) return false;
    if (filter.hazardType && entry.hazardType !== filter.hazardType) return false;

    return true;
  }

  private toDecision(entry: ReportAuditEntry): ReportDecision {
    return {
      id: entry.id,
      reportId: entry.reportId,
      districtId: entry.districtId,
      hazardType: entry.hazardType as HazardType,
      reviewStatus: this.actionToReviewStatus(entry.action),
      occurredAt: entry.occurredAt,
      officerId: entry.officerId,
      reason: entry.reason,
    };
  }

  /**
   * Map audit action to the reviewer status it represents.
   * CLARIFIED maps back to PENDING_REVIEW because the report went back
   * into the queue after the citizen added more information.
   */
  private actionToReviewStatus(action: ReportAuditEntry["action"]): ReviewStatus {
    const mapping: Record<ReportAuditEntry["action"], ReviewStatus> = {
      VERIFIED: "VERIFIED",
      REJECTED: "REJECTED",
      NEEDS_INFO: "NEEDS_INFO",
      CLARIFIED: "PENDING_REVIEW",
    };
    return mapping[action];
  }
}
