import type { HazardType } from '@/shared/domain';
import type { AlertRepository } from '../adapters/AlertRepository';
import type { ChannelGateway } from '../adapters/ChannelGateway';
import {
  type AlertTarget,
  HazardAlert,
  NotificationAttempt,
  NotFoundError,
  type Severity,
  ZeroRecipientsNotConfirmedError,
} from '../domain';
import type { Clock } from '../ports/Clock';
import type { DistrictNotificationStore } from '../ports/DistrictNotificationStore';
import type { IdGenerator } from '../ports/IdGenerator';
import type { DistrictNotification } from '../ports/types';
import type { ResolvedRecipient, TargetResolver } from './TargetResolver';

export interface PreviewResult {
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

export interface ChannelMetrics {
  sent: number;
  delivered: number;
  failed: number;
}

export interface DispatchResult {
  alert: HazardAlert;
  distinctCitizensReached: number;
  totalAttempts: number;
  channelSummary: {
    sms: ChannelMetrics;
    push: ChannelMetrics;
  };
  attempts: NotificationAttempt[];
}

export interface IssueWarningParams {
  title?: string;
  hazardType: HazardType;
  severity: Severity;
  message: string;
  target: AlertTarget;
  issuedBy: string;
  confirmZeroRecipients?: boolean;
  expiresAt?: Date | null;
}

export interface EscalateWarningParams {
  alertId: string;
  newSeverity: Severity;
  byOfficerId: string;
  reason?: string;
  expandDistrictIds?: string[];
  expandBasinId?: string;
}

export class WarningService {
  constructor(
    private readonly alertRepo: AlertRepository,
    private readonly targetResolver: TargetResolver,
    private readonly smsGateway: ChannelGateway,
    private readonly pushGateway: ChannelGateway,
    private readonly notificationStore: DistrictNotificationStore,
    private readonly clock: Clock,
    private readonly idGen: IdGenerator,
  ) {}

  /**
   * Previews estimated recipients and channel breakdown for a proposed alert target.
   */
  public async preview(target: AlertTarget): Promise<PreviewResult> {
    const recipients = await this.targetResolver.resolve(target);
    const byDistrict: Record<string, number> = {};
    let smsCount = 0;
    let pushCount = 0;
    let bothCount = 0;
    let noneCount = 0;

    for (const r of recipients) {
      byDistrict[r.districtId] = (byDistrict[r.districtId] ?? 0) + 1;
      const hasSms = r.channels.includes('SMS');
      const hasPush = r.channels.includes('PUSH');

      if (hasSms && hasPush) bothCount += 1;
      else if (hasSms) smsCount += 1;
      else if (hasPush) pushCount += 1;
      else noneCount += 1;
    }

    return {
      estimatedRecipients: recipients.length,
      distinctCitizens: recipients.length,
      byDistrict,
      byChannel: {
        sms: smsCount + bothCount,
        push: pushCount + bothCount,
        both: bothCount,
        none: noneCount,
      },
      targetDistrictIds: Object.keys(byDistrict),
    };
  }

  /**
   * Issues a new location-specific hazard warning.
   * Saves the ACTIVE alert FIRST before any notification attempts or gateway calls.
   */
  public async issue(params: IssueWarningParams): Promise<DispatchResult> {
    const recipients = await this.targetResolver.resolve(params.target);

    if (recipients.length === 0 && !params.confirmZeroRecipients) {
      throw new ZeroRecipientsNotConfirmedError();
    }

    const now = this.clock.now();
    const alertId = this.idGen.next();

    const alert = new HazardAlert({
      id: alertId,
      title: params.title,
      hazardType: params.hazardType,
      severity: params.severity,
      status: 'ACTIVE',
      message: params.message,
      target: params.target,
      issuedBy: params.issuedBy,
      occurredAt: now,
      expiresAt: params.expiresAt,
    });

    // 1. SAVE ACTIVE ALERT FIRST (Rule W02)
    await this.alertRepo.save(alert);

    // 2. Notify District Officers
    await this.notifyDistrictOfficers(alert, 'ISSUED', now);

    // 3. Dispatch to recipients
    const dispatchResult = await this.dispatchToRecipients(alert, recipients, 'ISSUE', params.message);
    return dispatchResult;
  }

  /**
   * Escalates an existing active alert to a higher severity level,
   * optionally widening the target geography. Re-notifies district officers.
   */
  public async escalate(params: EscalateWarningParams): Promise<DispatchResult> {
    const alert = await this.alertRepo.findById(params.alertId);
    if (!alert) {
      throw new NotFoundError(`Alert with ID ${params.alertId} not found.`);
    }

    const now = this.clock.now();
    const escalationId = this.idGen.next();

    // Domain entity enforces strict severity increase, max severity, closed check
    alert.escalate({
      escalationId,
      newSeverity: params.newSeverity,
      byOfficerId: params.byOfficerId,
      occurredAt: now,
      reason: params.reason,
      expandDistrictIds: params.expandDistrictIds,
      expandBasinId: params.expandBasinId,
    });

    // Save updated alert
    await this.alertRepo.save(alert);

    // Notify District Officers again (Rule W04)
    await this.notifyDistrictOfficers(alert, 'ESCALATED', now);

    // Resolve all citizens in the current + expanded target
    const allTargetRecipients = await this.targetResolver.resolve(alert.target);

    const escalationMessage = `[ESCALATION - ${alert.severity}] ${alert.message}${params.reason ? ` Reason: ${params.reason}` : ''}`;
    const dispatchResult = await this.dispatchToRecipients(
      alert,
      allTargetRecipients,
      'ESCALATION',
      escalationMessage,
    );

    return dispatchResult;
  }

  /**
   * Cancels an active or escalated alert, notifying all previously targeted recipients.
   */
  public async cancel(alertId: string, byOfficerId: string, reason: string): Promise<DispatchResult> {
    const alert = await this.alertRepo.findById(alertId);
    if (!alert) {
      throw new NotFoundError(`Alert with ID ${alertId} not found.`);
    }

    const now = this.clock.now();
    alert.cancel({
      byOfficerId,
      reason,
      cancelledAt: now,
    });

    await this.alertRepo.save(alert);

    // Find all distinct citizens previously targeted / attempted for this alert
    const previousAttempts = await this.alertRepo.findAttemptsByAlertId(alertId);
    const citizenIds = Array.from(new Set(previousAttempts.map((a) => a.citizenId)));

    const recipients = await this.targetResolver.resolve(alert.target);
    // Combine resolved recipients with any previously attempted citizens
    const cancellationRecipients = recipients.filter(
      (r) => citizenIds.length === 0 || citizenIds.includes(r.citizen.id) || true,
    );

    const cancellationMessage = `[CANCELLED] Hazard alert for ${alert.hazardType} has been cancelled. Reason: ${reason}`;
    const dispatchResult = await this.dispatchToRecipients(
      alert,
      cancellationRecipients,
      'CANCELLATION',
      cancellationMessage,
    );

    return dispatchResult;
  }

  /**
   * Retries all failed notification attempts for a given alert.
   * Keeps existing FAILED attempts and creates new attempt records.
   */
  public async retryFailed(alertId: string): Promise<DispatchResult> {
    const alert = await this.alertRepo.findById(alertId);
    if (!alert) {
      throw new NotFoundError(`Alert with ID ${alertId} not found.`);
    }

    const previousAttempts = await this.alertRepo.findAttemptsByAlertId(alertId);
    const failedAttempts = previousAttempts.filter((a) => a.status === 'FAILED');

    const newAttempts: NotificationAttempt[] = [];
    const smsSummary: ChannelMetrics = { sent: 0, delivered: 0, failed: 0 };
    const pushSummary: ChannelMetrics = { sent: 0, delivered: 0, failed: 0 };
    const deliveredCitizenIds = new Set<string>();

    for (const oldAttempt of failedAttempts) {
      const newAttemptId = this.idGen.next();
      const now = this.clock.now();

      const newAttempt = new NotificationAttempt({
        id: newAttemptId,
        alertId: alert.id,
        citizenId: oldAttempt.citizenId,
        districtId: oldAttempt.districtId,
        hazardType: alert.hazardType,
        channel: oldAttempt.channel,
        kind: oldAttempt.kind,
        occurredAt: now,
      });

      await this.alertRepo.saveAttempt(newAttempt);
      newAttempts.push(newAttempt);

      const gateway = oldAttempt.channel === 'SMS' ? this.smsGateway : this.pushGateway;
      const metrics = oldAttempt.channel === 'SMS' ? smsSummary : pushSummary;
      metrics.sent += 1;

      try {
        const sendResult = await gateway.send({
          attemptId: newAttempt.id,
          alertId: alert.id,
          citizenId: newAttempt.citizenId,
          destination: newAttempt.channel === 'SMS' ? 'phone' : 'pushToken',
          message: alert.message,
        });

        if (sendResult.success) {
          newAttempt.markDelivered(sendResult.deliveredAt ?? this.clock.now());
          metrics.delivered += 1;
          deliveredCitizenIds.add(newAttempt.citizenId);
        } else {
          newAttempt.markFailed(sendResult.errorReason ?? 'Delivery failed', this.clock.now());
          metrics.failed += 1;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown gateway error';
        newAttempt.markFailed(msg, this.clock.now());
        metrics.failed += 1;
      }

      await this.alertRepo.saveAttempt(newAttempt);
    }

    return {
      alert,
      distinctCitizensReached: deliveredCitizenIds.size,
      totalAttempts: newAttempts.length,
      channelSummary: {
        sms: smsSummary,
        push: pushSummary,
      },
      attempts: newAttempts,
    };
  }

  /**
   * Scans for active/escalated alerts that have exceeded expiresAt, and transitions them to EXPIRED.
   */
  public async expireDueAlerts(): Promise<HazardAlert[]> {
    const allAlerts = await this.alertRepo.listAll();
    const now = this.clock.now();
    const expired: HazardAlert[] = [];

    for (const alert of allAlerts) {
      if (!alert.isClosed() && alert.expiresAt && now.getTime() >= alert.expiresAt.getTime()) {
        const didExpire = alert.checkExpiration(now);
        if (didExpire) {
          await this.alertRepo.save(alert);
          expired.push(alert);
        }
      }
    }

    return expired;
  }

  private async notifyDistrictOfficers(
    alert: HazardAlert,
    kind: 'ISSUED' | 'ESCALATED',
    occurredAt: Date,
  ): Promise<void> {
    const targetDistricts = alert.target.districtIds ?? [];
    for (const districtId of targetDistricts) {
      const notification: DistrictNotification = {
        id: this.idGen.next(),
        alertId: alert.id,
        districtId,
        hazardType: alert.hazardType,
        kind,
        severity: alert.severity,
        occurredAt,
      };
      await this.notificationStore.add(notification);
    }
  }

  private async dispatchToRecipients(
    alert: HazardAlert,
    recipients: ResolvedRecipient[],
    kind: 'ISSUE' | 'ESCALATION' | 'CANCELLATION',
    message: string,
  ): Promise<DispatchResult> {
    const attempts: NotificationAttempt[] = [];
    const smsSummary: ChannelMetrics = { sent: 0, delivered: 0, failed: 0 };
    const pushSummary: ChannelMetrics = { sent: 0, delivered: 0, failed: 0 };
    const deliveredCitizenIds = new Set<string>();

    for (const r of recipients) {
      for (const channel of r.channels) {
        const attemptId = this.idGen.next();
        const now = this.clock.now();

        const attempt = new NotificationAttempt({
          id: attemptId,
          alertId: alert.id,
          citizenId: r.citizen.id,
          districtId: r.districtId,
          hazardType: alert.hazardType,
          channel,
          kind,
          occurredAt: now,
        });

        await this.alertRepo.saveAttempt(attempt);
        attempts.push(attempt);

        const gateway = channel === 'SMS' ? this.smsGateway : this.pushGateway;
        const metrics = channel === 'SMS' ? smsSummary : pushSummary;
        const destination = channel === 'SMS' ? (r.citizen.phone ?? '') : (r.citizen.pushToken ?? '');

        metrics.sent += 1;

        try {
          const sendResult = await gateway.send({
            attemptId: attempt.id,
            alertId: alert.id,
            citizenId: r.citizen.id,
            destination,
            message,
          });

          if (sendResult.success) {
            attempt.markDelivered(sendResult.deliveredAt ?? this.clock.now());
            metrics.delivered += 1;
            deliveredCitizenIds.add(r.citizen.id);
          } else {
            attempt.markFailed(sendResult.errorReason ?? 'Channel delivery failure', this.clock.now());
            metrics.failed += 1;
          }
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : 'Gateway exception';
          attempt.markFailed(errorMsg, this.clock.now());
          metrics.failed += 1;
        }

        await this.alertRepo.saveAttempt(attempt);
      }
    }

    return {
      alert,
      distinctCitizensReached: deliveredCitizenIds.size,
      totalAttempts: attempts.length,
      channelSummary: {
        sms: smsSummary,
        push: pushSummary,
      },
      attempts,
    };
  }
}
