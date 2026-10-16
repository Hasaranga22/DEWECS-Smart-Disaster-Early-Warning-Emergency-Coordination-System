import type { HazardType } from '@/shared/domain';
import { ValidationError } from './errors';

export const NOTIFICATION_CHANNELS = ['PUSH', 'SMS'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_STATUSES = ['QUEUED', 'SENT', 'DELIVERED', 'FAILED'] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const NOTIFICATION_KINDS = ['ISSUE', 'ESCALATION', 'CANCELLATION'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export interface NotificationAttemptProps {
  id: string;
  alertId: string;
  citizenId: string;
  districtId: string;
  hazardType: HazardType;
  channel: NotificationChannel;
  status?: NotificationStatus;
  kind: NotificationKind;
  occurredAt: Date;
  sentAt?: Date | null;
  deliveredAt?: Date | null;
  failureReason?: string | null;
}

export class NotificationAttempt {
  public readonly id: string;
  public readonly alertId: string;
  public readonly citizenId: string;
  public readonly districtId: string;
  public readonly hazardType: HazardType;
  public readonly channel: NotificationChannel;
  public readonly kind: NotificationKind;
  public readonly occurredAt: Date;

  private _status: NotificationStatus;
  private _sentAt: Date | null;
  private _deliveredAt: Date | null;
  private _failureReason: string | null;

  constructor(props: NotificationAttemptProps) {
    if (!props.id) {
      throw new ValidationError('Notification attempt ID is required.');
    }
    if (!props.alertId) {
      throw new ValidationError('Alert ID is required.');
    }
    if (!props.citizenId) {
      throw new ValidationError('Citizen ID is required.');
    }
    if (!props.districtId) {
      throw new ValidationError('District ID is required.');
    }

    this.id = props.id;
    this.alertId = props.alertId;
    this.citizenId = props.citizenId;
    this.districtId = props.districtId;
    this.hazardType = props.hazardType;
    this.channel = props.channel;
    this.kind = props.kind;
    this.occurredAt = props.occurredAt;
    this._status = props.status ?? 'QUEUED';
    this._sentAt = props.sentAt ?? null;
    this._deliveredAt = props.deliveredAt ?? null;
    this._failureReason = props.failureReason ?? null;
  }

  public get status(): NotificationStatus {
    return this._status;
  }

  public get sentAt(): Date | null {
    return this._sentAt;
  }

  public get deliveredAt(): Date | null {
    return this._deliveredAt;
  }

  public get failureReason(): string | null {
    return this._failureReason;
  }

  public markSent(sentAt: Date): void {
    this._status = 'SENT';
    this._sentAt = sentAt;
  }

  public markDelivered(deliveredAt: Date): void {
    this._status = 'DELIVERED';
    this._deliveredAt = deliveredAt;
    if (!this._sentAt) {
      this._sentAt = deliveredAt;
    }
  }

  public markFailed(reason: string, failedAt?: Date): void {
    this._status = 'FAILED';
    this._failureReason = reason;
    if (!this._sentAt && failedAt) {
      this._sentAt = failedAt;
    }
  }
}
