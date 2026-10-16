import { GroundReport } from "../domain/GroundReport";
import { ReportRepository } from "../adapters/ReportRepository";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Reports within this radius are considered potential duplicates. */
const DUPLICATE_RADIUS_METERS = 500;

/**
 * Reports captured within this window around the incoming report's
 * capture time are eligible for duplicate matching.
 */
const DUPLICATE_TIME_WINDOW_MS = 60 * 60 * 1000; // 60 minutes

// ─── Result Type ──────────────────────────────────────────────────────────────

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  /**
   * The earliest existing report that this new report corroborates.
   * Present only when isDuplicate is true.
   */
  existingReport: GroundReport | null;
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * DuplicateDetector
 *
 * Responsibility: Determine whether an incoming report is corroborating
 * an existing report rather than describing a new, separate incident.
 *
 * Business rule (README §14.3):
 *   Same hazard type + within 500 m + within 60 minutes → duplicate.
 *
 * What happens on duplicate:
 *   - Both reports are KEPT (we never delete).
 *   - The newer report is linked to the older one via linkedToReportId.
 *   - The officer sees a corroborationCount so they know multiple people
 *     reported the same incident.
 */
export class DuplicateDetector {
  constructor(private readonly reports: ReportRepository) {}

  /**
   * Check whether an incoming report matches an existing one.
   * If a match is found, returns the earliest existing report so the
   * caller can link the new report to it.
   */
  async check(incoming: GroundReport): Promise<DuplicateCheckResult> {
    const nearbyReports = await this.reports.findNearby({
      hazardType: incoming.hazardType,
      latitude: incoming.latitude,
      longitude: incoming.longitude,
      radiusMeters: DUPLICATE_RADIUS_METERS,
      captureTime: incoming.captureTime,
      windowMs: DUPLICATE_TIME_WINDOW_MS,
    });

    const otherReports = nearbyReports.filter(
      (report) => report.id !== incoming.id
    );

    if (otherReports.length === 0) {
      return { isDuplicate: false, existingReport: null };
    }

    // Link to the earliest captured report — that is the "primary" incident.
    const earliestReport = this.findEarliest(otherReports);
    return { isDuplicate: true, existingReport: earliestReport };
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private findEarliest(reports: GroundReport[]): GroundReport {
    return reports.reduce((earliest, current) =>
      current.captureTime < earliest.captureTime ? current : earliest
    );
  }
}
