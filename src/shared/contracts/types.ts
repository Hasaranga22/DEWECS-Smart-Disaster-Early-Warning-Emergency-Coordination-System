/**
 * Shared contract types used across all UC modules.
 *
 * Design decision — union types over enums:
 *   We use string union types instead of TypeScript enums throughout this
 *   project because:
 *   1. Prisma 7 generates string union types from schema enums — these are
 *      directly compatible without any conversion layer.
 *   2. String literals ("FLOOD") are self-documenting in logs and the DB.
 *   3. No import of an enum object is needed — just the type.
 */

export type HazardType = 'FLOOD' | 'LANDSLIDE' | 'CYCLONE' | 'DROUGHT' | 'OTHER';

export type LocationSource = 'GPS' | 'MANUAL_PIN';

export type ReportConfidence = 'FULL' | 'REDUCED';

export type ReviewStatus = 'PENDING_REVIEW' | 'NEEDS_INFO' | 'VERIFIED' | 'REJECTED';

export type SeverityIndication = 'LOW' | 'MEDIUM' | 'HIGH';

/** Generic filter used by all Reader contracts (UC4 aggregation). */
export interface Filter {
  from?: Date;
  to?: Date;
  districtId?: string;
  hazardType?: HazardType;
  /** Ignore records created after this timestamp (UC4 snapshot cutoff). */
  cutoff?: Date;
}

export type NotificationChannel = 'PUSH' | 'SMS';

export type DeliveryStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED';

/**
 * One delivery attempt of a hazard alert to one citizen via one channel.
 * Written by UC1, read by UC4 aggregation. Per README §4 the owner must
 * export it from contracts/types.ts exposing at least
 * { id, occurredAt, districtId, hazardType }.
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

/** Written by UC1, read by UC4 aggregation (README §4: owner exports from contracts/types.ts). */
export interface HazardAlert {
  id: string;
  hazardType: HazardType;
  severity: AlertSeverity;
  /** Alerts can target many districts; scoping happens inside the reader. */
  districtId?: string;
  occurredAt: Date;
}

/** Written by UC2, read by UC4 aggregation (README §4 + open decision #1). */
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

// ── Reader contracts (UC4 aggregation — all methods async, see README §4) ──

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

/** Roles offered by the role switcher (README §3). */
export type Role = 'CITIZEN' | 'DUTY_OFFICER' | 'DMC_OFFICIAL' | 'DISTRICT_OFFICER';

/** Authenticated caller injected into services by the API layer (getActor). */
export interface Actor {
  id: string;
  role: Role;
}

// Re-exported so contract consumers can also import Clock/IdGenerator from
// this module (they are defined in Clock.ts).
export type { Clock, IdGenerator } from './Clock';
