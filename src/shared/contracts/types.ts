export type HazardType = 'FLOOD' | 'LANDSLIDE' | 'CYCLONE' | 'DROUGHT' | 'OTHER';

export enum LocationSource {
  GPS = 'GPS',
  MANUAL_PIN = 'MANUAL_PIN'
}

export enum ReportConfidence {
  FULL = 'FULL',
  REDUCED = 'REDUCED'
}

export type ReviewStatus = 'PENDING_REVIEW' | 'NEEDS_INFO' | 'VERIFIED' | 'REJECTED';
