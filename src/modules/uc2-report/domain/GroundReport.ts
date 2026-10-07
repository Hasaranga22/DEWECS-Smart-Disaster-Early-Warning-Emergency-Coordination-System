import { HazardType, LocationSource, ReportConfidence, SeverityIndication } from "@/shared/contracts/types";
import { InvalidStateTransitionError } from "./errors";

export type ReviewStatus =
  | "PENDING_REVIEW"
  | "NEEDS_INFO"
  | "VERIFIED"
  | "REJECTED";

/**
 * Props required to instantiate a GroundReport.
 * All date/ID values must be injected via Clock and IdGenerator —
 * never call new Date() or crypto.randomUUID() inside this class.
 */
export interface GroundReportProps {
  id: string;
  localId: string;
  reporterId: string;
  districtId: string;
  hazardType: HazardType;
  description: string;
  latitude: number;
  longitude: number;
  locationSource: LocationSource;
  gpsAccuracyM?: number;
  photo?: string;
  confidence: ReportConfidence;
  reviewStatus: ReviewStatus;
  version: number;
  captureTime: Date;
  syncTime?: Date;
  severityIndication?: SeverityIndication;
  linkedToReportId?: string;
}

/**
 * GroundReport – the central domain entity for UC2.
 *
 * State machine for reviewStatus:
 *
 *   PENDING_REVIEW ──verify()──────────► VERIFIED   (terminal)
 *   PENDING_REVIEW ──reject(reason)────► REJECTED   (terminal)
 *   PENDING_REVIEW ──requestInfo()─────► NEEDS_INFO
 *   NEEDS_INFO     ──addClarification()► PENDING_REVIEW  (version +1)
 *
 * Every successful transition increments `version` (optimistic locking).
 * Terminal states (VERIFIED, REJECTED) reject all further transitions.
 */
export class GroundReport {
  private _props: GroundReportProps;

  private constructor(props: GroundReportProps) {
    this._props = { ...props };
  }

  // ─── Factory ──────────────────────────────────────────────────────────────

  static create(props: GroundReportProps): GroundReport {
    return new GroundReport(props);
  }

  // ─── Getters (read-only access) ───────────────────────────────────────────

  get id(): string { return this._props.id; }
  get localId(): string { return this._props.localId; }
  get reporterId(): string { return this._props.reporterId; }
  get districtId(): string { return this._props.districtId; }
  get hazardType(): HazardType { return this._props.hazardType; }
  get description(): string { return this._props.description; }
  get latitude(): number { return this._props.latitude; }
  get longitude(): number { return this._props.longitude; }
  get locationSource(): LocationSource { return this._props.locationSource; }
  get gpsAccuracyM(): number | undefined { return this._props.gpsAccuracyM; }
  get photo(): string | undefined { return this._props.photo; }
  get confidence(): ReportConfidence { return this._props.confidence; }
  get reviewStatus(): ReviewStatus { return this._props.reviewStatus; }
  get version(): number { return this._props.version; }
  get captureTime(): Date { return this._props.captureTime; }
  get syncTime(): Date | undefined { return this._props.syncTime; }
  get severityIndication(): SeverityIndication | undefined { return this._props.severityIndication; }
  get linkedToReportId(): string | undefined { return this._props.linkedToReportId; }

  // ─── State Machine Transitions ────────────────────────────────────────────

  /**
   * Verify the report.
   * Allowed only from PENDING_REVIEW.
   * Optionally records a severity indication for use by UC1 evidence panel.
   */
  verify(severityIndication?: SeverityIndication): void {
    this.assertStatus("PENDING_REVIEW", "verify");
    this._props.reviewStatus = "VERIFIED";
    if (severityIndication) {
      this._props.severityIndication = severityIndication;
    }
    this._props.version += 1;
  }

  /**
   * Reject the report with a mandatory reason.
   * Allowed only from PENDING_REVIEW.
   */
  reject(reason: string): void {
    this.assertStatus("PENDING_REVIEW", "reject");
    if (!reason || reason.trim().length === 0) {
      throw new Error("A rejection reason is required.");
    }
    this._props.reviewStatus = "REJECTED";
    this._props.version += 1;
  }

  /**
   * Move to NEEDS_INFO, prompting the reporter to add more details.
   * Allowed only from PENDING_REVIEW.
   */
  requestInfo(): void {
    this.assertStatus("PENDING_REVIEW", "requestInfo");
    this._props.reviewStatus = "NEEDS_INFO";
    this._props.version += 1;
  }

  /**
   * Reporter adds a clarification (photo or comment), returning the
   * report to PENDING_REVIEW on the same report (same ID, version +1).
   * Allowed only from NEEDS_INFO.
   */
  addClarification(updatedPhoto?: string): void {
    this.assertStatus("NEEDS_INFO", "addClarification");
    this._props.reviewStatus = "PENDING_REVIEW";
    if (updatedPhoto) {
      this._props.photo = updatedPhoto;
      // Photo supplied → restore full confidence
      this._props.confidence = "FULL";
    }
    this._props.version += 1;
  }

  /**
   * Link this report to an earlier one as corroboration.
   * Both reports are kept; this one references the other.
   */
  linkTo(otherReportId: string): void {
    this._props.linkedToReportId = otherReportId;
  }

  /**
   * Snapshot the props for persistence.
   * Returns a plain object so repositories never depend on the class itself.
   */
  toSnapshot(): Readonly<GroundReportProps> {
    return Object.freeze({ ...this._props });
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private assertStatus(
    required: ReviewStatus,
    action: string
  ): void {
    if (this._props.reviewStatus !== required) {
      throw new InvalidStateTransitionError(this._props.reviewStatus, action);
    }
  }
}
