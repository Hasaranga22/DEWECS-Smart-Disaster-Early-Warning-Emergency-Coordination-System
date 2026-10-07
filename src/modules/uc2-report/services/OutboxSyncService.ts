import { ReportRepository } from "../adapters/ReportRepository";
import { IdbOutboxRepository } from "../client/IdbOutboxRepository";
import { LocalOutboxEntry } from "../domain/LocalOutboxEntry";
import { DuplicateLocalIdError } from "../domain/errors";
import { ReportValidator, ReportDraft } from "./ReportValidator";
import { DuplicateDetector } from "./DuplicateDetector";
import { LocationSource, ReportConfidence } from "@/shared/contracts/types";
import { Clock } from "@/shared/contracts/Clock";

// ─── Result Types ─────────────────────────────────────────────────────────────

export interface SyncSummary {
  attempted: number;
  succeeded: number;
  failed: number;
  permanentlyFailed: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum sync attempts before an entry is marked permanently FAILED. */
const MAX_SYNC_ATTEMPTS = 3;

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * OutboxSyncService
 *
 * Responsibility: Upload pending offline reports to the server when the
 * device comes back online.
 *
 * Critical business rules:
 *
 * 1. Idempotency (README §B uc2):
 *    The same localId must NEVER create two server-side reports.
 *    If the server already has a report with that localId (DuplicateLocalIdError),
 *    we treat the sync as successful and remove the entry from the outbox.
 *    This handles the common case: sync failed mid-flight, device retried.
 *
 * 2. Permanent failure:
 *    After MAX_SYNC_ATTEMPTS, the entry is marked FAILED with a user-visible
 *    warning message. The officer can be reached by phone/radio as a fallback.
 *
 * 3. The outbox is IndexedDB only — it is never written to the server DB.
 *    An unsynced report must be invisible to the officer queue (G02).
 */
export class OutboxSyncService {
  constructor(
    private readonly outbox: IdbOutboxRepository,
    private readonly validator: ReportValidator,
    private readonly duplicateDetector: DuplicateDetector,
    private readonly reports: ReportRepository,
    private readonly clock: Clock
  ) {}

  /**
   * Process all pending outbox entries.
   * Returns a summary of what happened so the UI can show feedback.
   */
  async syncAll(reporterId: string, districtId: string): Promise<SyncSummary> {
    const pending = await this.outbox.getPending();

    const summary: SyncSummary = {
      attempted: pending.length,
      succeeded: 0,
      failed: 0,
      permanentlyFailed: 0,
    };

    for (const entry of pending) {
      const outcome = await this.syncEntry(entry, reporterId, districtId);

      if (outcome === "succeeded") summary.succeeded++;
      else if (outcome === "permanentlyFailed") summary.permanentlyFailed++;
      else summary.failed++;
    }

    return summary;
  }

  // ─── Private: Single Entry Sync ─────────────────────────────────────────────

  private async syncEntry(
    entry: LocalOutboxEntry,
    reporterId: string,
    districtId: string
  ): Promise<"succeeded" | "failed" | "permanentlyFailed"> {
    await this.markAsSyncing(entry);

    try {
      await this.uploadEntry(entry, reporterId, districtId);
      await this.outbox.remove(entry.localId);
      return "succeeded";
    } catch (error) {
      if (error instanceof DuplicateLocalIdError) {
        // Already on the server — treat as success (idempotency rule).
        await this.outbox.remove(entry.localId);
        return "succeeded";
      }

      return this.handleSyncFailure(entry, error);
    }
  }

  private async uploadEntry(
    entry: LocalOutboxEntry,
    reporterId: string,
    districtId: string
  ): Promise<void> {
    const draft: ReportDraft = {
      reporterId,
      districtId,
      localId: entry.localId,
      hazardType: entry.hazardType,
      description: entry.description,
      latitude: entry.latitude,
      longitude: entry.longitude,
      locationSource: entry.locationSource,
      gpsAccuracyM: entry.gpsAccuracyM,
      photo: entry.photoDataUrl,
      captureTime: new Date(entry.captureTime),
    };

    const report = await this.validator.validateAndSave(draft);

    const duplicateCheck = await this.duplicateDetector.check(report);
    if (duplicateCheck.isDuplicate && duplicateCheck.existingReport) {
      report.linkTo(duplicateCheck.existingReport.id);
      await this.reports.update(report, report.version);
    }
  }

  private async markAsSyncing(entry: LocalOutboxEntry): Promise<void> {
    await this.outbox.save({ ...entry, status: "SYNCING" });
  }

  private async handleSyncFailure(
    entry: LocalOutboxEntry,
    error: unknown
  ): Promise<"failed" | "permanentlyFailed"> {
    const failureReason =
      error instanceof Error ? error.message : "Unknown error";

    // Count previous failures by checking the current status and reason
    const attemptCount = this.parseAttemptCount(entry);
    const isPermamentFailure = attemptCount >= MAX_SYNC_ATTEMPTS;

    await this.outbox.save({
      ...entry,
      status: isPermamentFailure ? "FAILED" : "PENDING_SYNC",
      failureReason: isPermamentFailure
        ? `Could not be saved or sent after ${MAX_SYNC_ATTEMPTS} attempts – resubmit or contact the Duty Officer by radio/phone. (${failureReason})`
        : failureReason,
    });

    return isPermamentFailure ? "permanentlyFailed" : "failed";
  }

  /**
   * We encode attempt count in the failureReason prefix to avoid adding
   * an extra field to the LocalOutboxEntry interface.
   * A cleaner alternative would be to add `attemptCount` to the interface,
   * but that would require a migration of existing IndexedDB entries.
   */
  private parseAttemptCount(entry: LocalOutboxEntry): number {
    if (!entry.failureReason) return 1;
    const match = entry.failureReason.match(/attempt (\d+)/);
    return match ? parseInt(match[1], 10) + 1 : 1;
  }
}
