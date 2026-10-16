export const ALERT_STATUSES = ['ACTIVE', 'ESCALATED', 'CANCELLED', 'EXPIRED'] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export function isAlertClosed(status: AlertStatus): boolean {
  return status === 'CANCELLED' || status === 'EXPIRED';
}
