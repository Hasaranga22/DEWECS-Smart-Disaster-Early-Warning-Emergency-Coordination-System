import type { HazardType, Role } from '@/shared/domain';
import type { Severity } from './constants';

export interface WarningsClientProps {
  actorRole: Role;
  actorUserId: string;
  actorDistrictId?: string;
}


export interface EvidenceItem {
  reportId: string;
  hazardType: string;
  districtId: string;
  lat: number;
  lng: number;
  severityIndication?: string;
  confidence: string;
  corroborationCount: number;
  decidedAt: string;
}

export interface PreviewData {
  estimatedRecipients: number;
  distinctCitizens: number;
  byDistrict: Record<string, number>;
  byChannel: {
    sms: number;
    push: number;
    both: number;
    none: number;
  };
  targetDistrictIds: string[];
}

export interface AttemptItem {
  id: string;
  citizenId: string;
  districtId: string;
  channel: string;
  status: string;
  kind: string;
  occurredAt: string;
  failureReason?: string | null;
}

export interface DispatchResultData {
  alert: {
    id: string;
    title?: string | null;
    hazardType: string;
    severity: string;
    status: string;
    message: string;
    target: { districtIds?: string[]; basinId?: string };
    occurredAt: string;
  };
  distinctCitizensReached: number;
  totalAttempts: number;
  channelSummary: {
    sms: { sent: number; delivered: number; failed: number };
    push: { sent: number; delivered: number; failed: number };
  };
  attempts?: AttemptItem[];
}

export interface AlertItem {
  id: string;
  title?: string | null;
  hazardType: string;
  severity: string;
  status: string;
  message: string;
  target: { districtIds?: string[]; basinId?: string };
  issuedBy: string;
  occurredAt: string;
  expiresAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  escalations?: Array<{
    id: string;
    fromSeverity: string;
    toSeverity: string;
    occurredAt: string;
    reason?: string;
  }>;
}

export type { Severity, HazardType };
