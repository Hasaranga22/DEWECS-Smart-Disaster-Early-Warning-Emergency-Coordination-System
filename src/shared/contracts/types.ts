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

export interface ReportDecision {
  id: string;
  reportId: string;
  districtId: string;
  hazardType: HazardType;
  reviewStatus: 'PENDING_REVIEW' | 'NEEDS_INFO' | 'VERIFIED' | 'REJECTED';
  occurredAt: Date;
  officerId?: string;
  reason?: string;
}

export interface HazardAlert {
  id: string;
  occurredAt: Date;
  districtId: string;
  hazardType?: HazardType;
}

export interface NotificationAttempt {
  id: string;
  occurredAt: Date;
  districtId: string;
  hazardType?: HazardType;
}

export interface OccupancyEvent {
  id: string;
  occurredAt: Date;
  districtId: string;
  hazardType?: HazardType;
}

export interface Distribution {
  id: string;
  occurredAt: Date;
  districtId: string;
  hazardType?: HazardType;
}
