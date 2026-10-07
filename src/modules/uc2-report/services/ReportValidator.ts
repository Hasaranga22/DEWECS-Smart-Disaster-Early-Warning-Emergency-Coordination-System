import { Clock, IdGenerator } from "@/shared/contracts/Clock";
import { ValidationError } from "../domain/errors";
import { HazardType, LocationSource, ReportConfidence } from "@/shared/contracts/types";
import { GroundReport } from "../domain/GroundReport";
import { ReportRepository } from "../adapters/ReportRepository";

// ─── Input & Output Types ─────────────────────────────────────────────────────

export interface ReportDraft {
  reporterId: string;
  districtId: string;
  hazardType: HazardType;
  description: string;
  latitude: number;
  longitude: number;
  locationSource: LocationSource;
  gpsAccuracyM?: number;
  photo?: string;
  localId: string;
  captureTime: Date;
}

export interface ValidationResult {
  isValid: boolean;
  invalidFields: string[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * ReportValidator
 *
 * Responsibility: Decide whether a draft report has all required fields.
 *
 * On failure: returns the list of invalid fields so the UI can highlight
 * them inline. The draft is always kept — we never discard user input.
 *
 * On success: creates and persists a GroundReport in PENDING_REVIEW status.
 */
export class ReportValidator {
  constructor(
    private readonly reports: ReportRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator
  ) {}

  /**
   * Validate the draft.
   * Returns which fields are missing without saving anything.
   * Call this for instant UI feedback as the user fills the form.
   */
  validate(draft: ReportDraft): ValidationResult {
    const invalidFields: string[] = [];

    if (!draft.hazardType) {
      invalidFields.push("hazardType");
    }

    if (!draft.description || draft.description.trim().length === 0) {
      invalidFields.push("description");
    }

    if (!this.hasValidLocation(draft)) {
      invalidFields.push("location");
    }

    return {
      isValid: invalidFields.length === 0,
      invalidFields,
    };
  }

  /**
   * Validate and, if valid, save the report as PENDING_REVIEW.
   * Throws ValidationError if the draft is incomplete.
   */
  async validateAndSave(draft: ReportDraft): Promise<GroundReport> {
    const result = this.validate(draft);

    if (!result.isValid) {
      throw new ValidationError(
        result.invalidFields,
        `Report is missing required fields: ${result.invalidFields.join(", ")}.`
      );
    }

    const confidence = this.resolveConfidence(draft);

    const report = GroundReport.create({
      id: this.ids.next(),
      localId: draft.localId,
      reporterId: draft.reporterId,
      districtId: draft.districtId,
      hazardType: draft.hazardType,
      description: draft.description.trim(),
      latitude: draft.latitude,
      longitude: draft.longitude,
      locationSource: draft.locationSource,
      gpsAccuracyM: draft.gpsAccuracyM,
      photo: draft.photo,
      confidence,
      reviewStatus: "PENDING_REVIEW",
      version: 0,
      captureTime: draft.captureTime,
      syncTime: this.clock.now(),
    });

    await this.reports.save(report);
    return report;
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  /**
   * A location is valid when both coordinates are present.
   * GPS accuracy > 100m is allowed here — the caller (UI) already prompted
   * the user to switch to a manual pin before submitting.
   */
  private hasValidLocation(draft: ReportDraft): boolean {
    return (
      typeof draft.latitude === "number" &&
      typeof draft.longitude === "number" &&
      !isNaN(draft.latitude) &&
      !isNaN(draft.longitude)
    );
  }

  /**
   * Business rule: if no photo is provided, confidence is REDUCED.
   * The field already reflects what the client set, but we enforce the
   * rule centrally here so it cannot be bypassed via the API.
   */
  private resolveConfidence(draft: ReportDraft): ReportConfidence {
    return draft.photo ? "FULL" : "REDUCED";
  }
}
