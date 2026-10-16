import { ReportRepository } from "../adapters/ReportRepository";
import { ReportDraft, ReportValidator } from "./ReportValidator";
import { DuplicateDetector } from "./DuplicateDetector";
import { IdbOutboxRepository } from "../client/IdbOutboxRepository";
import { GroundReport } from "../domain/GroundReport";
import { LocalOutboxEntry } from "../domain/LocalOutboxEntry";
import { DuplicateLocalIdError } from "../domain/errors";
import { Clock } from "@/shared/contracts/Clock";

// ─── Result Types ─────────────────────────────────────────────────────────────

/** Returned when submission succeeded via direct server upload. */
export interface OnlineSubmissionResult {
  channel: "online";
  report: GroundReport;
  /** True if this report corroborates an existing incident. */
  isCorroboration: boolean;
}

/** Returned when the device was offline and the report was queued locally. */
export interface OfflineSubmissionResult {
  channel: "offline";
  outboxEntry: LocalOutboxEntry;
}

export type SubmissionResult = OnlineSubmissionResult | OfflineSubmissionResult;

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * SubmissionService
 *
 * Responsibility: Route a citizen's report draft to the correct channel.
 *
 * Online path:
 *   Validate → check for duplicate → save to repository → return report.
 *
 * Offline path:
 *   Save to browser IndexedDB outbox → return outbox entry.
 *   The OutboxSyncService will pick this up and upload it later.
 *
 * The caller (API route or component) checks result.channel to know
 * which path was taken and show the appropriate UI feedback.
 */
export class SubmissionService {
  constructor(
    private readonly reports: ReportRepository,
    private readonly validator: ReportValidator,
    private readonly duplicateDetector: DuplicateDetector,
    private readonly outbox: IdbOutboxRepository,
    private readonly clock: Clock
  ) {}

  /**
   * Submit a report draft.
   * Pass isOnline from the NetworkStatus context so the service remains
   * testable without a real network connection.
   */
  async submit(
    draft: ReportDraft,
    isOnline: boolean
  ): Promise<SubmissionResult> {
    if (!isOnline) {
      return this.saveToOutbox(draft);
    }

    return this.uploadToServer(draft);
  }

  // ─── Private: Online Path ───────────────────────────────────────────────────

  private async uploadToServer(draft: ReportDraft): Promise<OnlineSubmissionResult> {
    const report = await this.validator.validateAndSave(draft);

    const duplicateCheck = await this.duplicateDetector.check(report);

    if (duplicateCheck.isDuplicate && duplicateCheck.existingReport) {
      report.linkTo(duplicateCheck.existingReport.id);
      // Persist the linkage — version does NOT increment here since linkTo
      // is not a state-machine transition, just metadata enrichment.
      await this.reports.update(report, report.version);
    }

    return {
      channel: "online",
      report,
      isCorroboration: duplicateCheck.isDuplicate,
    };
  }

  // ─── Private: Offline Path ──────────────────────────────────────────────────

  private async saveToOutbox(draft: ReportDraft): Promise<OfflineSubmissionResult> {
    const outboxEntry: LocalOutboxEntry = {
      localId: draft.localId,
      hazardType: draft.hazardType,
      description: draft.description,
      latitude: draft.latitude,
      longitude: draft.longitude,
      locationSource: draft.locationSource,
      gpsAccuracyM: draft.gpsAccuracyM,
      photoDataUrl: draft.photo,
      confidence: draft.photo ? "FULL" : "REDUCED",
      status: "PENDING_SYNC",
      captureTime: draft.captureTime.toISOString(),
    };

    await this.outbox.save(outboxEntry);
    return { channel: "offline", outboxEntry };
  }
}
