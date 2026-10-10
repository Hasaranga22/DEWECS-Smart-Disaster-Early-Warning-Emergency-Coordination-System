/**
 * Shared contract types used across all UC modules in DEWECS.
 *
 * All interfaces return Promises for storage/repository queries
 * to support both in-memory and Prisma async operations.
 */

export type HazardType = 'FLOOD' | 'LANDSLIDE' | 'CYCLONE' | 'DROUGHT' | 'OTHER';

export type Role = 'CITIZEN' | 'DUTY_OFFICER' | 'DMC_OFFICIAL' | 'DISTRICT_OFFICER';

export type LocationSource = 'GPS' | 'MANUAL_PIN';

export type ReportConfidence = 'FULL' | 'REDUCED';

export type ReviewStatus = 'PENDING_REVIEW' | 'NEEDS_INFO' | 'VERIFIED' | 'REJECTED';

export type SeverityIndication = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Actor {
  id: string;
  role: Role;
  districtId?: string;
}

export interface Filter {
  from?: Date;
  to?: Date;
  districtId?: string;
  hazardType?: HazardType;
  /** Cutoff timestamp for snapshot generation (occurredAt <= cutoff). */
  cutoff?: Date;
}

export interface VerifiedEvidence {
  reportId: string;
  hazardType: HazardType;
  districtId: string;
  lat: number;
  lng: number;
  severityIndication?: SeverityIndication;
  confidence: ReportConfidence;
  corroborationCount: number;
  decidedAt: Date;
  occurredAt: Date;
}

export interface DistrictNotification {
  id: string;
  alertId: string;
  districtId: string;
  hazardType: HazardType;
  kind: 'ISSUED' | 'ESCALATED';
  severity: string;
  occurredAt: Date;
  readAt?: Date;
}

export type NotificationChannel = 'PUSH' | 'SMS';

export type DeliveryStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED';

/**
 * One delivery attempt of a hazard alert to one citizen via one channel.
 * Written by UC1, read by UC4 aggregation.
 */
export interface NotificationAttempt {
  id: string;
  alertId: string;
  citizenId: string;
  districtId: string;
  hazardType: HazardType;
  channel: NotificationChannel;
  deliveryStatus: DeliveryStatus;
  /** When the underlying alert event happened. */
  occurredAt: Date;
  /** When this delivery attempt was made. */
  attemptAt: Date;
}

export type AlertSeverity = 'ADVISORY' | 'WATCH' | 'WARNING' | 'EMERGENCY';

/** Written by UC1, read by UC4 aggregation. */
export interface HazardAlert {
  id: string;
  hazardType: HazardType;
  severity: AlertSeverity;
  /** Alerts can target many districts; scoping happens inside the reader. */
  districtId?: string;
  occurredAt: Date;
}

/** Written by UC2, read by UC4 aggregation. */
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

/** Written by UC3, read by UC4 aggregation. */
export interface OccupancyEvent {
  id: string;
  shelterId: string;
  districtId: string;
  previousCount: number;
  newCount: number;
  occurredAt: Date;
}

/**
 * Written by UC3, read by UC4 aggregation. Dated row, never a running total:
 * `distributed` is the quantity moved by this event, `total` is the planned /
 * available quantity for the supply type in scope (0 → percent null, BR10).
 */
export interface Distribution {
  id: string;
  supplyType: string;
  districtId: string;
  distributed: number;
  total: number;
  occurredAt: Date;
}

// ── Reader contracts (UC4 aggregation — all methods async) ──

export interface AlertReader {
  listAlerts(f: Filter): Promise<HazardAlert[]>;
}

export interface AttemptReader {
  listAttempts(f: Filter): Promise<NotificationAttempt[]>;
}

export interface ReportDecisionReader {
  listDecisions(f: Filter): Promise<ReportDecision[]>;
}

export interface OccupancyEventReader {
  listEvents(f: Filter): Promise<OccupancyEvent[]>;
}

export interface DistributionReader {
  listDistributions(f: Filter): Promise<Distribution[]>;
}

// Re-exported so UC4 and tests can import Clock/IdGenerator from types.
export type { Clock, IdGenerator } from './Clock';

export interface SupplyStock {
  id: string;
  organizationId: string;
  districtId: string;
  supplyType: string;
  onHand: number;
  updatedAt: Date;
}

export interface SupplyStockReader {
  listStocks(f: Filter): Promise<SupplyStock[]>;
}
