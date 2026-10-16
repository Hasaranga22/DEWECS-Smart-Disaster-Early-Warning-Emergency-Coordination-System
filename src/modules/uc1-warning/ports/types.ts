// TODO: Move to src/shared/contracts/types.ts once shared contracts package is created
import type { HazardType } from '@/shared/domain';

export interface Filter {
  from?: Date;
  to?: Date;
  districtId?: string;
  hazardType?: HazardType;
  cutoff?: Date;
}

export interface VerifiedEvidence {
  reportId: string;
  hazardType: HazardType;
  districtId: string;
  lat: number;
  lng: number;
  severityIndication?: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: 'FULL' | 'REDUCED';
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
