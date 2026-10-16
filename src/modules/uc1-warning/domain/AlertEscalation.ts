import type { Severity } from './Severity';

export interface AlertEscalation {
  id: string;
  alertId: string;
  fromSeverity: Severity;
  toSeverity: Severity;
  occurredAt: Date;
  byOfficerId: string;
  reason?: string;
}
