import type { HazardType as SharedHazardType } from '@/shared/domain';
import {
  type AlertEscalation,
  type AlertStatus,
  HazardAlert,
  type NotificationChannel,
  NotificationAttempt,
  type NotificationKind,
  type NotificationStatus,
  type Severity,
} from '../../domain';

export type PrismaHazardAlertWithRelations = {
  id: string;
  title?: string | null;
  hazardType: string;
  severity: string;
  status: string;
  message: string;
  issuedById: string;
  occurredAt: Date;
  expiresAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  createdAt: Date;
  targetDistricts?: Array<{ districtId: string }>;
  targetBasins?: Array<{ basinId: string }>;
  escalations?: Array<{
    id: string;
    alertId: string;
    fromSeverity: string;
    toSeverity: string;
    occurredAt: Date;
    byOfficerId: string;
    reason: string | null;
  }>;
};

export type PrismaNotificationAttemptRow = {
  id: string;
  alertId: string;
  citizenId: string;
  districtId: string;
  hazardType: string;
  channel: string;
  status: string;
  kind: string;
  occurredAt: Date;
  sentAt: Date | null;
  deliveredAt: Date | null;
  failureReason: string | null;
};

export function toDomainAlert(raw: PrismaHazardAlertWithRelations): HazardAlert {
  const districtIds = raw.targetDistricts?.map((d) => d.districtId);
  const basinId = raw.targetBasins?.[0]?.basinId;

  const escalations: AlertEscalation[] = (raw.escalations ?? []).map((e) => ({
    id: e.id,
    alertId: e.alertId,
    fromSeverity: e.fromSeverity as Severity,
    toSeverity: e.toSeverity as Severity,
    occurredAt: e.occurredAt,
    byOfficerId: e.byOfficerId,
    reason: e.reason ?? undefined,
  }));

  return new HazardAlert({
    id: raw.id,
    title: raw.title ?? undefined,
    hazardType: raw.hazardType as SharedHazardType,
    severity: raw.severity as Severity,
    status: raw.status as AlertStatus,
    message: raw.message,
    target: {
      districtIds: districtIds && districtIds.length > 0 ? districtIds : undefined,
      basinId,
    },
    issuedBy: raw.issuedById,
    occurredAt: raw.occurredAt,
    createdAt: raw.createdAt,
    expiresAt: raw.expiresAt,
    cancelledAt: raw.cancelledAt,
    cancellationReason: raw.cancellationReason,
    escalations,
  });
}

export function toDomainAttempt(raw: PrismaNotificationAttemptRow): NotificationAttempt {
  return new NotificationAttempt({
    id: raw.id,
    alertId: raw.alertId,
    citizenId: raw.citizenId,
    districtId: raw.districtId,
    hazardType: raw.hazardType as SharedHazardType,
    channel: raw.channel as NotificationChannel,
    status: raw.status as NotificationStatus,
    kind: raw.kind as NotificationKind,
    occurredAt: raw.occurredAt,
    sentAt: raw.sentAt,
    deliveredAt: raw.deliveredAt,
    failureReason: raw.failureReason,
  });
}
