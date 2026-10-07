import { GroundReport, ReviewStatus } from "../domain/GroundReport";
import { SeverityIndication } from "@/shared/contracts/types";
import { ReportRepository } from "../adapters/ReportRepository";
import { VersionConflictError } from "../domain/errors";
import { Clock, IdGenerator } from "@/shared/contracts/Clock";

// ─── Audit Entry Types ────────────────────────────────────────────────────────

export type AuditAction = "VERIFIED" | "REJECTED" | "NEEDS_INFO" | "CLARIFIED";

export interface ReportAuditEntry {
  id: string;
  reportId: string;
  action: AuditAction;
  officerId?: string;
  reason?: string;
  note?: string;
  occurredAt: Date;
  districtId: string;
  hazardType: string;
}

/** Minimal interface for persisting audit trail entries. */
export interface AuditRepository {
  save(entry: ReportAuditEntry): Promise<void>;
  findByReport(reportId: string): Promise<ReportAuditEntry[]>;
  findAll(): Promise<ReportAuditEntry[]>;
}

// ─── Input Types ──────────────────────────────────────────────────────────────

export interface VerifyInput {
  reportId: string;
  expectedVersion: number;
  officerId: string;
  severityIndication?: SeverityIndication;
}

export interface RejectInput {
  reportId: string;
  expectedVersion: number;
  officerId: string;
  reason: string;
}

export interface RequestInfoInput {
  reportId: string;
  expectedVersion: number;
  officerId: string;
  note?: string;
}

export interface AddClarificationInput {
  reportId: string;
  expectedVersion: number;
  updatedPhoto?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * ReviewService
 *
 * Responsibility: Execute Duty Officer review decisions on a GroundReport.
 *
 * Each method follows this strict sequence to ensure correctness:
 *   1. Load the current report from the repository.
 *   2. Apply the state-machine transition on the domain object.
 *   3. Persist the updated report using optimistic locking.
 *   4. Record an immutable audit entry for the UC4 analysis trail.
 *
 * Optimistic locking:
 *   The caller must supply `expectedVersion` (the version they last read).
 *   If another officer reviewed the same report between the read and the
 *   write, the repository throws VersionConflictError — we let it bubble
 *   up so the API route can return 409 Conflict and the UI can reload.
 */
export class ReviewService {
  constructor(
    private readonly reports: ReportRepository,
    private readonly audits: AuditRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator
  ) {}

  /**
   * Mark a report as VERIFIED.
   * Only callable by a Duty Officer (enforced in the API route layer).
   */
  async verify(input: VerifyInput): Promise<GroundReport> {
    const report = await this.loadOrThrow(input.reportId);

    report.verify(input.severityIndication);
    await this.reports.update(report, input.expectedVersion);

    await this.recordAudit({
      reportId: report.id,
      action: "VERIFIED",
      officerId: input.officerId,
      districtId: report.districtId,
      hazardType: report.hazardType,
    });

    return report;
  }

  /**
   * Reject the report with a mandatory reason.
   * Rejection notifies the reporter (done in the API route via email/push).
   */
  async reject(input: RejectInput): Promise<GroundReport> {
    const report = await this.loadOrThrow(input.reportId);

    report.reject(input.reason);
    await this.reports.update(report, input.expectedVersion);

    await this.recordAudit({
      reportId: report.id,
      action: "REJECTED",
      officerId: input.officerId,
      reason: input.reason,
      districtId: report.districtId,
      hazardType: report.hazardType,
    });

    return report;
  }

  /**
   * Request more information from the reporter.
   * Moves report to NEEDS_INFO — the reporter sees this on /report/mine.
   */
  async requestInfo(input: RequestInfoInput): Promise<GroundReport> {
    const report = await this.loadOrThrow(input.reportId);

    report.requestInfo();
    await this.reports.update(report, input.expectedVersion);

    await this.recordAudit({
      reportId: report.id,
      action: "NEEDS_INFO",
      officerId: input.officerId,
      note: input.note,
      districtId: report.districtId,
      hazardType: report.hazardType,
    });

    return report;
  }

  /**
   * Reporter adds a clarification (photo or note).
   * Returns the report to PENDING_REVIEW (same ID, version +1).
   * The officer queue will show it again for re-review.
   */
  async addClarification(input: AddClarificationInput): Promise<GroundReport> {
    const report = await this.loadOrThrow(input.reportId);

    report.addClarification(input.updatedPhoto);
    await this.reports.update(report, input.expectedVersion);

    await this.recordAudit({
      reportId: report.id,
      action: "CLARIFIED",
      districtId: report.districtId,
      hazardType: report.hazardType,
    });

    return report;
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private async loadOrThrow(reportId: string): Promise<GroundReport> {
    const report = await this.reports.findById(reportId);
    if (!report) {
      throw new Error(`Report "${reportId}" not found.`);
    }
    return report;
  }

  private async recordAudit(params: {
    reportId: string;
    action: AuditAction;
    officerId?: string;
    reason?: string;
    note?: string;
    districtId: string;
    hazardType: string;
  }): Promise<void> {
    const entry: ReportAuditEntry = {
      id: this.ids.next(),
      reportId: params.reportId,
      action: params.action,
      officerId: params.officerId,
      reason: params.reason,
      note: params.note,
      occurredAt: this.clock.now(),
      districtId: params.districtId,
      hazardType: params.hazardType,
    };

    await this.audits.save(entry);
  }
}
