import type { HazardType } from '@/shared/domain';
import type { AlertEscalation } from './AlertEscalation';
import type { AlertStatus } from './AlertStatus';
import {
  AlertClosedError,
  InvalidSeverityTransitionError,
  MaxSeverityError,
  ValidationError,
} from './errors';
import { isHigherSeverity, type Severity } from './Severity';

export interface AlertTarget {
  districtIds?: string[];
  basinId?: string;
}

export interface HazardAlertProps {
  id: string;
  title?: string;
  hazardType: HazardType;
  severity: Severity;
  status?: AlertStatus;
  message: string;
  target: AlertTarget;
  issuedBy: string;
  occurredAt: Date;
  expiresAt?: Date | null;
  cancelledAt?: Date | null;
  cancellationReason?: string | null;
  escalations?: AlertEscalation[];
  createdAt?: Date;
}

export class HazardAlert {
  public readonly id: string;
  public readonly title?: string;
  public readonly hazardType: HazardType;
  public readonly issuedBy: string;
  public readonly occurredAt: Date;
  public readonly createdAt: Date;

  private _severity: Severity;
  private _status: AlertStatus;
  private _message: string;
  private _target: AlertTarget;
  private _expiresAt: Date | null;
  private _cancelledAt: Date | null;
  private _cancellationReason: string | null;
  private _escalations: AlertEscalation[];

  constructor(props: HazardAlertProps) {
    if (!props.id) {
      throw new ValidationError('Alert ID is required.');
    }
    if (!props.message || props.message.trim().length === 0) {
      throw new ValidationError('Alert message cannot be empty.');
    }
    if (props.hazardType === 'OTHER') {
      throw new ValidationError('Hazard type "OTHER" is not permitted for hazard warnings.');
    }
    const hasDistricts = props.target?.districtIds && props.target.districtIds.length > 0;
    const hasBasin = Boolean(props.target?.basinId);
    if (!hasDistricts && !hasBasin) {
      throw new ValidationError('Alert must target at least one district or a river basin.');
    }

    if (props.title && props.title.trim().length > 80) {
      throw new ValidationError('Alert title cannot exceed 80 characters.');
    }

    this.id = props.id;
    this.title = props.title?.trim() ? props.title.trim() : undefined;
    this.hazardType = props.hazardType;
    this._severity = props.severity;
    this._status = props.status ?? 'ACTIVE';
    this._message = props.message;
    this._target = {
      districtIds: props.target.districtIds ? [...props.target.districtIds] : undefined,
      basinId: props.target.basinId,
    };
    this.issuedBy = props.issuedBy;
    this.occurredAt = props.occurredAt;
    this.createdAt = props.createdAt ?? props.occurredAt;
    this._expiresAt = props.expiresAt ?? null;
    this._cancelledAt = props.cancelledAt ?? null;
    this._cancellationReason = props.cancellationReason ?? null;
    this._escalations = props.escalations ? [...props.escalations] : [];
  }

  public get severity(): Severity {
    return this._severity;
  }

  public get status(): AlertStatus {
    return this._status;
  }

  public get message(): string {
    return this._message;
  }

  public get target(): AlertTarget {
    return {
      districtIds: this._target.districtIds ? [...this._target.districtIds] : undefined,
      basinId: this._target.basinId,
    };
  }

  public get expiresAt(): Date | null {
    return this._expiresAt;
  }

  public get cancelledAt(): Date | null {
    return this._cancelledAt;
  }

  public get cancellationReason(): string | null {
    return this._cancellationReason;
  }

  public get escalations(): ReadonlyArray<AlertEscalation> {
    return [...this._escalations];
  }

  public isClosed(): boolean {
    return this._status === 'CANCELLED' || this._status === 'EXPIRED';
  }

  /**
   * Escalates this alert to a strictly higher severity.
   */
  public escalate(params: {
    escalationId: string;
    newSeverity: Severity;
    byOfficerId: string;
    occurredAt: Date;
    reason?: string;
    expandDistrictIds?: string[];
    expandBasinId?: string;
  }): AlertEscalation {
    if (this.isClosed()) {
      throw new AlertClosedError(this.id, this._status);
    }
    if (this._severity === 'EMERGENCY') {
      throw new MaxSeverityError(this.id);
    }
    if (!isHigherSeverity(params.newSeverity, this._severity)) {
      throw new InvalidSeverityTransitionError(this._severity, params.newSeverity);
    }

    const previousSeverity = this._severity;
    this._severity = params.newSeverity;
    this._status = 'ESCALATED';

    if (params.expandDistrictIds && params.expandDistrictIds.length > 0) {
      const merged = new Set([...(this._target.districtIds ?? []), ...params.expandDistrictIds]);
      this._target.districtIds = Array.from(merged);
    }
    if (params.expandBasinId) {
      this._target.basinId = params.expandBasinId;
    }

    const escalation: AlertEscalation = {
      id: params.escalationId,
      alertId: this.id,
      fromSeverity: previousSeverity,
      toSeverity: params.newSeverity,
      occurredAt: params.occurredAt,
      byOfficerId: params.byOfficerId,
      reason: params.reason,
    };

    this._escalations.push(escalation);
    return escalation;
  }

  /**
   * Cancels this alert.
   */
  public cancel(params: {
    byOfficerId: string;
    reason: string;
    cancelledAt: Date;
  }): void {
    if (this.isClosed()) {
      throw new AlertClosedError(this.id, this._status);
    }
    if (!params.reason || params.reason.trim().length === 0) {
      throw new ValidationError('Cancellation reason is required.');
    }

    this._status = 'CANCELLED';
    this._cancelledAt = params.cancelledAt;
    this._cancellationReason = params.reason;
  }

  /**
   * Checks if the alert has passed its expiration time and updates status to EXPIRED.
   */
  public checkExpiration(now: Date): boolean {
    if (this.isClosed()) {
      return false;
    }
    if (this._expiresAt && now.getTime() >= this._expiresAt.getTime()) {
      this._status = 'EXPIRED';
      return true;
    }
    return false;
  }
}
