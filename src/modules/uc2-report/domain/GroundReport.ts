import { HazardType, LocationSource, ReportConfidence, SeverityIndication } from "@/shared/contracts/types";
import { InvalidStateTransitionError } from "./errors";

export type ReviewStatus =
  | "PENDING_REVIEW"
  | "NEEDS_INFO"
  | "VERIFIED"
  | "REJECTED";

export type IncidentMapStatus = "ACTIVE" | "RESOLVED";

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
  mapStatus?: IncidentMapStatus;
  mapVisibleUntil?: Date;
  resolvedAt?: Date;
  resolvedByOfficerId?: string;
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
    this._props = { ...props, mapStatus: props.mapStatus ?? "ACTIVE" };
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
  get mapStatus(): IncidentMapStatus { return this._props.mapStatus ?? "ACTIVE"; }
  get mapVisibleUntil(): Date | undefined { return this._props.mapVisibleUntil; }
  get resolvedAt(): Date | undefined { return this._props.resolvedAt; }
  get resolvedByOfficerId(): string | undefined { return this._props.resolvedByOfficerId; }
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

  /** Starts the seven-day map lifecycle when an officer verifies a report. */
  activateOnMap(visibleUntil: Date): void {
    this.assertStatus("VERIFIED", "activate incident");
    this._props.mapStatus = "ACTIVE";
    this._props.mapVisibleUntil = visibleUntil;
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
   * Removes a verified incident from the live operations map while preserving
   * the verified report and its audit history for post-event review.
   */
  resolveIncident(officerId: string, resolvedAt: Date): void {
    this.assertStatus("VERIFIED", "resolve incident");
    if (this.mapStatus !== "ACTIVE") {
      throw new InvalidStateTransitionError(this.mapStatus, "resolve incident");
    }
    this._props.mapStatus = "RESOLVED";
    this._props.resolvedAt = resolvedAt;
    this._props.resolvedByOfficerId = officerId;
    this._props.version += 1;
  }

  /** Keeps an unresolved verified incident on the live map for longer. */
  extendMapVisibility(visibleUntil: Date): void {
    this.assertStatus("VERIFIED", "extend incident");
    if (this.mapStatus !== "ACTIVE") {
      throw new InvalidStateTransitionError(this.mapStatus, "extend incident");
    }
    this._props.mapVisibleUntil = visibleUntil;
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
