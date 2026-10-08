import { describe, expect, it } from 'vitest';
import { NotificationAttempt, ValidationError } from '../domain';

describe('NotificationAttempt domain entity', () => {
  const baseDate = new Date('2026-10-08T10:00:00.000Z');

  it('creates an attempt with default QUEUED status and validates fields', () => {
    const attempt = new NotificationAttempt({
      id: 'att-1',
      alertId: 'alert-1',
      citizenId: 'cit-1',
      districtId: 'dist-colombo',
      hazardType: 'FLOOD',
      channel: 'SMS',
      kind: 'ISSUE',
      occurredAt: baseDate,
    });

    expect(attempt.id).toBe('att-1');
    expect(attempt.status).toBe('QUEUED');
    expect(attempt.channel).toBe('SMS');
    expect(attempt.kind).toBe('ISSUE');
    expect(attempt.sentAt).toBeNull();
    expect(attempt.deliveredAt).toBeNull();
    expect(attempt.failureReason).toBeNull();
  });

  it('rejects missing required attributes', () => {
    expect(
      () =>
        new NotificationAttempt({
          id: '',
          alertId: 'alert-1',
          citizenId: 'cit-1',
          districtId: 'dist-colombo',
          hazardType: 'FLOOD',
          channel: 'SMS',
          kind: 'ISSUE',
          occurredAt: baseDate,
        }),
    ).toThrow(ValidationError);
  });

  it('updates status on markSent, markDelivered, and markFailed', () => {
    const attempt = new NotificationAttempt({
      id: 'att-1',
      alertId: 'alert-1',
      citizenId: 'cit-1',
      districtId: 'dist-colombo',
      hazardType: 'FLOOD',
      channel: 'PUSH',
      kind: 'ISSUE',
      occurredAt: baseDate,
    });

    const sentDate = new Date('2026-10-08T10:00:02.000Z');
    attempt.markSent(sentDate);
    expect(attempt.status).toBe('SENT');
    expect(attempt.sentAt).toEqual(sentDate);

    const deliveredDate = new Date('2026-10-08T10:00:05.000Z');
    attempt.markDelivered(deliveredDate);
    expect(attempt.status).toBe('DELIVERED');
    expect(attempt.deliveredAt).toEqual(deliveredDate);

    const failedAttempt = new NotificationAttempt({
      id: 'att-2',
      alertId: 'alert-1',
      citizenId: 'cit-2',
      districtId: 'dist-colombo',
      hazardType: 'FLOOD',
      channel: 'SMS',
      kind: 'ISSUE',
      occurredAt: baseDate,
    });

    failedAttempt.markFailed('SMS Gateway timeout', new Date('2026-10-08T10:00:10.000Z'));
    expect(failedAttempt.status).toBe('FAILED');
    expect(failedAttempt.failureReason).toBe('SMS Gateway timeout');
  });
});
