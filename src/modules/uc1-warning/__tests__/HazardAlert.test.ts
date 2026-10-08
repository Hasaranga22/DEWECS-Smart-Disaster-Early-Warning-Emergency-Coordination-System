import { describe, expect, it } from 'vitest';
import {
  AlertClosedError,
  HazardAlert,
  InvalidSeverityTransitionError,
  MaxSeverityError,
  ValidationError,
} from '../domain';

describe('HazardAlert domain entity and state machine', () => {
  const baseDate = new Date('2026-10-08T10:00:00.000Z');

  it('successfully creates an ACTIVE alert with valid parameters', () => {
    const alert = new HazardAlert({
      id: 'alert-1',
      hazardType: 'FLOOD',
      severity: 'ADVISORY',
      message: 'Heavy rain expected in low-lying areas.',
      target: { districtIds: ['dist-colombo'] },
      issuedBy: 'officer-1',
      occurredAt: baseDate,
    });

    expect(alert.id).toBe('alert-1');
    expect(alert.status).toBe('ACTIVE');
    expect(alert.severity).toBe('ADVISORY');
    expect(alert.isClosed()).toBe(false);
    expect(alert.escalations).toHaveLength(0);
  });

  it('rejects empty message, missing id, or empty target', () => {
    expect(
      () =>
        new HazardAlert({
          id: '',
          hazardType: 'FLOOD',
          severity: 'ADVISORY',
          message: 'Message',
          target: { districtIds: ['dist-colombo'] },
          issuedBy: 'officer-1',
          occurredAt: baseDate,
        }),
    ).toThrow(ValidationError);

    expect(
      () =>
        new HazardAlert({
          id: 'alert-1',
          hazardType: 'FLOOD',
          severity: 'ADVISORY',
          message: '   ',
          target: { districtIds: ['dist-colombo'] },
          issuedBy: 'officer-1',
          occurredAt: baseDate,
        }),
    ).toThrow(ValidationError);

    expect(
      () =>
        new HazardAlert({
          id: 'alert-1',
          hazardType: 'FLOOD',
          severity: 'ADVISORY',
          message: 'Message',
          target: {},
          issuedBy: 'officer-1',
          occurredAt: baseDate,
        }),
    ).toThrow(ValidationError);
  });

  it('rejects hazardType OTHER for warnings', () => {
    expect(
      () =>
        new HazardAlert({
          id: 'alert-1',
          hazardType: 'OTHER',
          severity: 'ADVISORY',
          message: 'Message',
          target: { districtIds: ['dist-colombo'] },
          issuedBy: 'officer-1',
          occurredAt: baseDate,
        }),
    ).toThrow(ValidationError);
  });

  it('escalates severity strictly UP (ADVISORY -> WATCH -> WARNING -> EMERGENCY)', () => {
    const alert = new HazardAlert({
      id: 'alert-1',
      hazardType: 'FLOOD',
      severity: 'ADVISORY',
      message: 'Initial flood advisory.',
      target: { districtIds: ['dist-colombo'] },
      issuedBy: 'officer-1',
      occurredAt: baseDate,
    });

    const escalation1 = alert.escalate({
      escalationId: 'esc-1',
      newSeverity: 'WATCH',
      byOfficerId: 'officer-1',
      occurredAt: new Date('2026-10-08T11:00:00.000Z'),
      reason: 'River levels rising past threshold 1',
    });

    expect(alert.status).toBe('ESCALATED');
    expect(alert.severity).toBe('WATCH');
    expect(escalation1.fromSeverity).toBe('ADVISORY');
    expect(escalation1.toSeverity).toBe('WATCH');
    expect(alert.escalations).toHaveLength(1);

    const escalation2 = alert.escalate({
      escalationId: 'esc-2',
      newSeverity: 'EMERGENCY',
      byOfficerId: 'officer-1',
      occurredAt: new Date('2026-10-08T12:00:00.000Z'),
      reason: 'Critical dam overflow imminent',
    });

    expect(alert.severity).toBe('EMERGENCY');
    expect(escalation2.fromSeverity).toBe('WATCH');
    expect(escalation2.toSeverity).toBe('EMERGENCY');
    expect(alert.escalations).toHaveLength(2);
  });

  it('throws MaxSeverityError when attempting to escalate an EMERGENCY alert', () => {
    const alert = new HazardAlert({
      id: 'alert-1',
      hazardType: 'CYCLONE',
      severity: 'EMERGENCY',
      message: 'Severe cyclone warning.',
      target: { districtIds: ['dist-colombo'] },
      issuedBy: 'officer-1',
      occurredAt: baseDate,
    });

    expect(() =>
      alert.escalate({
        escalationId: 'esc-1',
        newSeverity: 'EMERGENCY',
        byOfficerId: 'officer-1',
        occurredAt: baseDate,
      }),
    ).toThrow(MaxSeverityError);
  });

  it('throws InvalidSeverityTransitionError when attempting to downgrade or stay at same severity', () => {
    const alert = new HazardAlert({
      id: 'alert-1',
      hazardType: 'FLOOD',
      severity: 'WARNING',
      message: 'Flood warning.',
      target: { districtIds: ['dist-colombo'] },
      issuedBy: 'officer-1',
      occurredAt: baseDate,
    });

    expect(() =>
      alert.escalate({
        escalationId: 'esc-1',
        newSeverity: 'WATCH',
        byOfficerId: 'officer-1',
        occurredAt: baseDate,
      }),
    ).toThrow(InvalidSeverityTransitionError);

    expect(() =>
      alert.escalate({
        escalationId: 'esc-2',
        newSeverity: 'WARNING',
        byOfficerId: 'officer-1',
        occurredAt: baseDate,
      }),
    ).toThrow(InvalidSeverityTransitionError);
  });

  it('cancels from ACTIVE or ESCALATED with cancellation details', () => {
    const alert = new HazardAlert({
      id: 'alert-1',
      hazardType: 'FLOOD',
      severity: 'ADVISORY',
      message: 'Flood advisory.',
      target: { districtIds: ['dist-colombo'] },
      issuedBy: 'officer-1',
      occurredAt: baseDate,
    });

    const cancelDate = new Date('2026-10-08T14:00:00.000Z');
    alert.cancel({
      byOfficerId: 'officer-1',
      reason: 'Water levels receded safely',
      cancelledAt: cancelDate,
    });

    expect(alert.status).toBe('CANCELLED');
    expect(alert.isClosed()).toBe(true);
    expect(alert.cancelledAt).toEqual(cancelDate);
    expect(alert.cancellationReason).toBe('Water levels receded safely');
  });

  it('throws AlertClosedError when trying to escalate or cancel an already CANCELLED alert', () => {
    const alert = new HazardAlert({
      id: 'alert-1',
      hazardType: 'FLOOD',
      severity: 'ADVISORY',
      status: 'CANCELLED',
      message: 'Flood advisory.',
      target: { districtIds: ['dist-colombo'] },
      issuedBy: 'officer-1',
      occurredAt: baseDate,
    });

    expect(() =>
      alert.escalate({
        escalationId: 'esc-1',
        newSeverity: 'WARNING',
        byOfficerId: 'officer-1',
        occurredAt: baseDate,
      }),
    ).toThrow(AlertClosedError);

    expect(() =>
      alert.cancel({
        byOfficerId: 'officer-1',
        reason: 'Duplicate cancel',
        cancelledAt: baseDate,
      }),
    ).toThrow(AlertClosedError);
  });

  it('transitions to EXPIRED when checkExpiration is called past expiresAt', () => {
    const alert = new HazardAlert({
      id: 'alert-1',
      hazardType: 'FLOOD',
      severity: 'ADVISORY',
      message: 'Flood advisory.',
      target: { districtIds: ['dist-colombo'] },
      issuedBy: 'officer-1',
      occurredAt: baseDate,
      expiresAt: new Date('2026-10-08T12:00:00.000Z'),
    });

    expect(alert.checkExpiration(new Date('2026-10-08T11:59:00.000Z'))).toBe(false);
    expect(alert.status).toBe('ACTIVE');

    expect(alert.checkExpiration(new Date('2026-10-08T12:00:00.000Z'))).toBe(true);
    expect(alert.status).toBe('EXPIRED');
    expect(alert.isClosed()).toBe(true);

    expect(() =>
      alert.escalate({
        escalationId: 'esc-1',
        newSeverity: 'WARNING',
        byOfficerId: 'officer-1',
        occurredAt: baseDate,
      }),
    ).toThrow(AlertClosedError);
  });

  it('correctly widens target districts during escalation', () => {
    const alert = new HazardAlert({
      id: 'alert-1',
      hazardType: 'FLOOD',
      severity: 'WATCH',
      message: 'Flood watch.',
      target: { districtIds: ['dist-colombo'] },
      issuedBy: 'officer-1',
      occurredAt: baseDate,
    });

    alert.escalate({
      escalationId: 'esc-1',
      newSeverity: 'WARNING',
      byOfficerId: 'officer-1',
      occurredAt: baseDate,
      expandDistrictIds: ['dist-gampaha', 'dist-colombo'], // duplicate dist-colombo should be deduplicated
    });

    expect(alert.target.districtIds).toEqual(['dist-colombo', 'dist-gampaha']);
  });
});
