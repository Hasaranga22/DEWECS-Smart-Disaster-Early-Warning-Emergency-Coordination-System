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
