import { beforeEach, describe, expect, it } from 'vitest';
import type { Citizen, RiverBasin } from '@/shared/domain';
import { FakeClock } from '../adapters/fakes/FakeClock';
import { SequentialIdGenerator } from '../adapters/fakes/SequentialIdGenerator';
import { InMemoryAlertRepository } from '../adapters/InMemoryAlertRepository';
import { InMemoryDistrictNotificationStore } from '../adapters/InMemoryDistrictNotificationStore';
import { MockPushGateway } from '../adapters/MockPushGateway';
import { MockSmsGateway } from '../adapters/MockSmsGateway';
import {
  AlertClosedError,
  InvalidSeverityTransitionError,
  MaxSeverityError,
  ZeroRecipientsNotConfirmedError,
} from '../domain';
import { TargetResolver } from '../services/TargetResolver';
import { WarningService } from '../services/WarningService';

describe('WarningService', () => {
  let alertRepo: InMemoryAlertRepository;
  let notificationStore: InMemoryDistrictNotificationStore;
  let clock: FakeClock;
  let idGen: SequentialIdGenerator;
  let smsGateway: MockSmsGateway;
  let pushGateway: MockPushGateway;
  let targetResolver: TargetResolver;
  let warningService: WarningService;

  const mockCitizens: Citizen[] = [
    {
      id: 'cit-1',
      name: 'Kamal Perera',
      districtId: 'dist-colombo',
      phone: '+94771234567',
      pushToken: 'push-tok-1',
      isVolunteer: false,
    },
    {
      id: 'cit-2',
      name: 'Nimal Silva',
      districtId: 'dist-colombo',
      phone: '+94772345678',
      isVolunteer: false,
    },
    {
      id: 'cit-3',
      name: 'Sunil Fernando',
      districtId: 'dist-gampaha',
      pushToken: 'push-tok-3',
      isVolunteer: false,
    },
    {
      id: 'cit-4',
      name: 'Anura Kumara',
      districtId: 'dist-kegalle',
      phone: '+94774444444',
      pushToken: 'push-tok-4',
      isVolunteer: false,
    },
  ];

  const mockBasin: RiverBasin = {
    id: 'basin-kelani',
    name: 'Kelani River Basin',
    districtIds: ['dist-colombo', 'dist-gampaha', 'dist-kegalle'],
  };

  beforeEach(() => {
    alertRepo = new InMemoryAlertRepository();
    notificationStore = new InMemoryDistrictNotificationStore();
    clock = new FakeClock('2026-10-08T10:00:00.000Z');
    idGen = new SequentialIdGenerator('id');
    smsGateway = new MockSmsGateway({ failureRate: 0, clock });
    pushGateway = new MockPushGateway({ failureRate: 0, clock });

    targetResolver = new TargetResolver(
      { listAll: async () => mockCitizens },
      { getById: async (id) => (id === 'basin-kelani' ? mockBasin : null) },
    );

    warningService = new WarningService(
      alertRepo,
      targetResolver,
      smsGateway,
      pushGateway,
      notificationStore,
      clock,
      idGen,
    );
  });

  it('W01: preview shows estimated recipients and unique citizens with breakdown', async () => {
    const preview = await warningService.preview({
      districtIds: ['dist-colombo', 'dist-gampaha'],
      basinId: 'basin-kelani',
    });

    expect(preview.estimatedRecipients).toBe(4);
    expect(preview.distinctCitizens).toBe(4);
    expect(preview.byDistrict['dist-colombo']).toBe(2);
    expect(preview.byDistrict['dist-gampaha']).toBe(1);
    expect(preview.byDistrict['dist-kegalle']).toBe(1);
    expect(preview.byChannel.sms).toBe(3); // cit-1, cit-2, cit-4
    expect(preview.byChannel.push).toBe(3); // cit-1, cit-3, cit-4
    expect(preview.byChannel.both).toBe(2); // cit-1, cit-4
  });

  it('W02: ACTIVE alert is saved before any attempts are made', async () => {
    const saveOrder: string[] = [];

    const originalSave = alertRepo.save.bind(alertRepo);
    alertRepo.save = async (alert) => {
      saveOrder.push(`ALERT_SAVED:${alert.status}`);
      return originalSave(alert);
    };

    const originalSaveAttempt = alertRepo.saveAttempt.bind(alertRepo);
    alertRepo.saveAttempt = async (attempt) => {
      saveOrder.push(`ATTEMPT_SAVED:${attempt.channel}:${attempt.status}`);
      return originalSaveAttempt(attempt);
    };

    const result = await warningService.issue({
      hazardType: 'FLOOD',
      severity: 'WARNING',
      message: 'Urgent flood evacuation warning',
      target: { districtIds: ['dist-colombo'] },
      issuedBy: 'officer-dmc-1',
    });

    expect(result.alert.status).toBe('ACTIVE');
    expect(saveOrder[0]).toBe('ALERT_SAVED:ACTIVE');
    expect(saveOrder.some((item) => item.startsWith('ATTEMPT_SAVED'))).toBe(true);
    // Alert save was first
    expect(saveOrder.indexOf('ALERT_SAVED:ACTIVE')).toBe(0);
  });

  it('W03: partial SMS failure continues other channels; distinct citizens reached', async () => {
    // Make SMS fail for cit-2, while PUSH and other SMS succeed
    smsGateway.setRandomSource(() => 0.1); // fail SMS if rate = 0.5
    smsGateway.setFailureRate(0.5);

    // Specifically fail SMS for cit-2 while cit-1 has PUSH which succeeds
    const result = await warningService.issue({
      hazardType: 'FLOOD',
      severity: 'WATCH',
      message: 'Rising water levels in Colombo',
      target: { districtIds: ['dist-colombo'] }, // cit-1 (both SMS+PUSH), cit-2 (only SMS)
      issuedBy: 'officer-dmc-1',
    });

    expect(result.channelSummary.sms.failed).toBeGreaterThan(0);
    // PUSH attempts were not aborted by SMS failures
    expect(result.channelSummary.push.delivered).toBeGreaterThan(0);
    // Distinct citizens reached is count of citizens with AT LEAST ONE delivered attempt
    expect(result.distinctCitizensReached).toBe(1); // cit-1 reached via PUSH
  });

  it('W04: escalate notifies district officers again', async () => {
    const issueResult = await warningService.issue({
      hazardType: 'FLOOD',
      severity: 'ADVISORY',
      message: 'Advisory for Colombo and Gampaha',
      target: { districtIds: ['dist-colombo', 'dist-gampaha'] },
      issuedBy: 'officer-dmc-1',
    });

    const notificationsAfterIssue = await notificationStore.listAll();
    expect(notificationsAfterIssue).toHaveLength(2); // one for Colombo, one for Gampaha
    expect(notificationsAfterIssue.every((n) => n.kind === 'ISSUED')).toBe(true);

    // Advance clock
    clock.advanceHours(2);

    await warningService.escalate({
      alertId: issueResult.alert.id,
      newSeverity: 'WARNING',
      byOfficerId: 'officer-dmc-1',
      reason: 'Rainfall exceeded 150mm',
    });

    const notificationsAfterEscalate = await notificationStore.listAll();
    expect(notificationsAfterEscalate).toHaveLength(4); // 2 ISSUED + 2 ESCALATED
    const escalatedNotifications = notificationsAfterEscalate.filter((n) => n.kind === 'ESCALATED');
    expect(escalatedNotifications).toHaveLength(2);
    expect(escalatedNotifications.map((n) => n.severity)).toEqual(['WARNING', 'WARNING']);
  });

  it('W05: invalid escalate/cancel changes nothing (assert repo state before == after)', async () => {
    // 1. Max severity alert (EMERGENCY)
    const issueEmergency = await warningService.issue({
      hazardType: 'FLOOD',
      severity: 'EMERGENCY', // Max severity
      message: 'Emergency alert',
      target: { districtIds: ['dist-colombo'] },
      issuedBy: 'officer-dmc-1',
    });

    const emergencyBefore = await alertRepo.findById(issueEmergency.alert.id);
    const emergencyBeforeSnapshot = JSON.stringify(emergencyBefore);

    // Attempt to escalate max severity
    await expect(
      warningService.escalate({
        alertId: issueEmergency.alert.id,
        newSeverity: 'EMERGENCY',
        byOfficerId: 'officer-dmc-1',
      }),
    ).rejects.toThrow(MaxSeverityError);

    const alertAfterFailedMaxEscalate = await alertRepo.findById(issueEmergency.alert.id);
    expect(JSON.stringify(alertAfterFailedMaxEscalate)).toBe(emergencyBeforeSnapshot);

    // 2. Watch alert to test invalid downgrade
    const issueWatch = await warningService.issue({
      hazardType: 'FLOOD',
      severity: 'WATCH',
      message: 'Watch alert',
      target: { districtIds: ['dist-colombo'] },
      issuedBy: 'officer-dmc-1',
    });

    const watchBefore = await alertRepo.findById(issueWatch.alert.id);
    const watchBeforeSnapshot = JSON.stringify(watchBefore);

    await expect(
      warningService.escalate({
        alertId: issueWatch.alert.id,
        newSeverity: 'ADVISORY', // Lower severity transition
        byOfficerId: 'officer-dmc-1',
      }),
    ).rejects.toThrow(InvalidSeverityTransitionError);

    const alertAfterFailedDowngrade = await alertRepo.findById(issueWatch.alert.id);
    expect(JSON.stringify(alertAfterFailedDowngrade)).toBe(watchBeforeSnapshot);

    // 3. Cancel the alert
    await warningService.cancel(issueEmergency.alert.id, 'officer-dmc-1', 'Cancelled by DMC');
    const cancelledSnapshot = JSON.stringify(await alertRepo.findById(issueEmergency.alert.id));

    // 4. Attempt to cancel again (already CANCELLED)
    await expect(
      warningService.cancel(issueEmergency.alert.id, 'officer-dmc-1', 'Duplicate cancellation'),
    ).rejects.toThrow(AlertClosedError);

    const alertAfterSecondCancel = await alertRepo.findById(issueEmergency.alert.id);
    expect(JSON.stringify(alertAfterSecondCancel)).toBe(cancelledSnapshot);
  });

  it('W06: zero recipients needs confirmation, count is zero', async () => {
    // Empty district with no citizens
    await expect(
      warningService.issue({
        hazardType: 'DROUGHT',
        severity: 'ADVISORY',
        message: 'Drought advisory',
        target: { districtIds: ['dist-empty-uninhabited'] },
        issuedBy: 'officer-dmc-1',
      }),
    ).rejects.toThrow(ZeroRecipientsNotConfirmedError);

    // With confirmZeroRecipients = true, proceeds and records 0 reach
    const result = await warningService.issue({
      hazardType: 'DROUGHT',
      severity: 'ADVISORY',
      message: 'Drought advisory',
      target: { districtIds: ['dist-empty-uninhabited'] },
      issuedBy: 'officer-dmc-1',
      confirmZeroRecipients: true,
    });

    expect(result.alert.status).toBe('ACTIVE');
    expect(result.distinctCitizensReached).toBe(0);
    expect(result.totalAttempts).toBe(0);
  });

  it('cancel sends cancellation notice to previously targeted recipients', async () => {
    const issueResult = await warningService.issue({
      hazardType: 'FLOOD',
      severity: 'WATCH',
      message: 'Flood watch',
      target: { districtIds: ['dist-colombo'] },
      issuedBy: 'officer-dmc-1',
    });

    const cancelResult = await warningService.cancel(
      issueResult.alert.id,
      'officer-dmc-1',
      'Water levels returned to normal',
    );

    expect(cancelResult.alert.status).toBe('CANCELLED');
    expect(cancelResult.attempts.some((a) => a.kind === 'CANCELLATION')).toBe(true);
    expect(smsGateway.sentMessages.some((m) => m.message.includes('[CANCELLED]'))).toBe(true);
  });

  it('retryFailed creates new attempts and keeps old FAILED rows', async () => {
    // Set SMS failure rate = 1.0 initially
    smsGateway.setFailureRate(1.0);

    const issueResult = await warningService.issue({
      hazardType: 'FLOOD',
      severity: 'WARNING',
      message: 'Urgent flood warning',
      target: { districtIds: ['dist-colombo'] },
      issuedBy: 'officer-dmc-1',
    });

    const attemptsAfterIssue = await alertRepo.findAttemptsByAlertId(issueResult.alert.id);
    const initialFailed = attemptsAfterIssue.filter((a) => a.status === 'FAILED');
    expect(initialFailed.length).toBeGreaterThan(0);

    // Fix SMS gateway
    smsGateway.setFailureRate(0);

    // Retry failed
    const retryResult = await warningService.retryFailed(issueResult.alert.id);
    expect(retryResult.channelSummary.sms.delivered).toBe(initialFailed.length);

    const allAttempts = await alertRepo.findAttemptsByAlertId(issueResult.alert.id);
    // Old failed attempts still exist + new delivered attempts
    expect(allAttempts.some((a) => a.status === 'FAILED')).toBe(true);
    expect(allAttempts.length).toBe(attemptsAfterIssue.length + initialFailed.length);
  });

  it('expireDueAlerts transitions active alerts past expiresAt to EXPIRED', async () => {
    const expireTime = new Date('2026-10-08T12:00:00.000Z');

    const issueResult = await warningService.issue({
      hazardType: 'CYCLONE',
      severity: 'WATCH',
      message: 'Cyclone watch until noon',
      target: { districtIds: ['dist-colombo'] },
      issuedBy: 'officer-dmc-1',
      expiresAt: expireTime,
    });

    // Advance clock to 11:30 (not expired yet)
    clock.setTime('2026-10-08T11:30:00.000Z');
    let expired = await warningService.expireDueAlerts();
    expect(expired).toHaveLength(0);

    // Advance clock to 12:05 (expired)
    clock.setTime('2026-10-08T12:05:00.000Z');
    expired = await warningService.expireDueAlerts();
    expect(expired).toHaveLength(1);
    expect(expired[0].id).toBe(issueResult.alert.id);
    expect(expired[0].status).toBe('EXPIRED');

    const updatedAlert = await alertRepo.findById(issueResult.alert.id);
    expect(updatedAlert?.status).toBe('EXPIRED');
  });
});
