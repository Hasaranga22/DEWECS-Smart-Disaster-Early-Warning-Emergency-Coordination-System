import { HazardType, ReportConfidence, SeverityIndication } from "@/shared/contracts/types";
import { ReportRepository } from "../adapters/ReportRepository";

// ─── Shared Contract Type ─────────────────────────────────────────────────────

/** Exported via shared contracts — UC1 reads this to show evidence in the alert composer. */
export interface VerifiedEvidence {
  reportId: string;
  hazardType: HazardType;
  districtId: string;
  lat: number;
  lng: number;
  severityIndication?: SeverityIndication;
  confidence: "FULL" | "REDUCED";
  corroborationCount: number;
  decidedAt: Date;
  occurredAt: Date;
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * EvidenceProviderImpl
 *
 * Responsibility: Implement the VerifiedEvidenceProvider contract for UC1.
 *
 * CRITICAL rule (README §7):
 *   Only VERIFIED reports are eligible evidence.
 *   Unverified, pending, or rejected reports are NEVER exposed here.
 *   UC1 must not auto-issue a warning from evidence — it is read-only context.
 */
export class EvidenceProviderImpl {
  constructor(private readonly reports: ReportRepository) {}

  /**
   * List verified reports, optionally scoped to a district.
   * UC1 calls this to populate the "verified ground reports" evidence panel.
   */
  async listVerified(districtId?: string): Promise<VerifiedEvidence[]> {
    const allReports = districtId
      ? await this.reports.findByDistrict(districtId)
      : await this.reports.findAll();

    const verifiedReports = allReports.filter(
      (report) => report.reviewStatus === "VERIFIED"
    );

    return verifiedReports.map((report) => ({
      reportId: report.id,
      hazardType: report.hazardType,
      districtId: report.districtId,
      lat: report.latitude,
      lng: report.longitude,
      severityIndication: report.severityIndication,
      confidence: report.confidence,
      corroborationCount: this.countCorroborations(report.id, verifiedReports.map(r => r.linkedToReportId)),
      decidedAt: report.syncTime ?? report.captureTime,
      occurredAt: report.captureTime,
    }));
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  /**
   * Count how many OTHER reports link to this report as the primary incident.
   * This gives UC1 the corroboration count to display on the evidence panel.
   */
  private countCorroborations(
    reportId: string,
    linkedToReportIds: (string | undefined)[]
  ): number {
    return linkedToReportIds.filter((id) => id === reportId).length;
  }
}
