import type { NotificationAttempt } from '@/shared/contracts/types'

/**
 * G04 fixture — one citizen (C001) reached via two channels must count once.
 *
 * - C001: SMS DELIVERED + PUSH DELIVERED (2 channels, 1 citizen)
 * - C002: SMS FAILED   + PUSH DELIVERED
 * - C003: SMS FAILED   + PUSH FAILED
 * - C004: SMS DELIVERED only
 *
 * Expected: distinctCitizens = 3 (C001, C002, C004),
 *           PUSH = { attempted: 3, delivered: 2, failed: 1 },
 *           SMS  = { attempted: 4, delivered: 2, failed: 2 }.
 */
export const fakeAttempts: NotificationAttempt[] = [
  // C001 — reached on both channels
  {
    id: 'attempt-001',
    citizenId: 'C001',
    channel: 'SMS',
    deliveryStatus: 'DELIVERED',
    occurredAt: new Date('2026-08-01T06:00:00.000Z'),
    districtId: 'district-kelani',
    hazardType: 'FLOOD',
    alertId: 'alert-001',
    attemptAt: new Date('2026-08-01T06:01:00.000Z'),
  },
  {
    id: 'attempt-002',
    citizenId: 'C001',
    channel: 'PUSH',
    deliveryStatus: 'DELIVERED',
    occurredAt: new Date('2026-08-01T06:00:00.000Z'),
    districtId: 'district-kelani',
    hazardType: 'FLOOD',
    alertId: 'alert-001',
    attemptAt: new Date('2026-08-01T06:01:00.000Z'),
  },
  // C002 — SMS failed, PUSH delivered → reached
  {
    id: 'attempt-003',
    citizenId: 'C002',
    channel: 'SMS',
    deliveryStatus: 'FAILED',
    occurredAt: new Date('2026-08-01T06:00:00.000Z'),
    districtId: 'district-kelani',
    hazardType: 'FLOOD',
    alertId: 'alert-001',
    attemptAt: new Date('2026-08-01T06:01:00.000Z'),
  },
  {
    id: 'attempt-004',
    citizenId: 'C002',
    channel: 'PUSH',
    deliveryStatus: 'DELIVERED',
    occurredAt: new Date('2026-08-01T06:00:00.000Z'),
    districtId: 'district-kelani',
    hazardType: 'FLOOD',
    alertId: 'alert-001',
    attemptAt: new Date('2026-08-01T06:01:00.000Z'),
  },
  // C003 — failed on both channels → NOT reached
  {
    id: 'attempt-005',
    citizenId: 'C003',
    channel: 'SMS',
    deliveryStatus: 'FAILED',
    occurredAt: new Date('2026-08-01T06:00:00.000Z'),
    districtId: 'district-kelani',
    hazardType: 'FLOOD',
    alertId: 'alert-001',
    attemptAt: new Date('2026-08-01T06:01:00.000Z'),
  },
  {
    id: 'attempt-006',
    citizenId: 'C003',
    channel: 'PUSH',
    deliveryStatus: 'FAILED',
    occurredAt: new Date('2026-08-01T06:00:00.000Z'),
    districtId: 'district-kelani',
    hazardType: 'FLOOD',
    alertId: 'alert-001',
    attemptAt: new Date('2026-08-01T06:01:00.000Z'),
  },
  // C004 — SMS only, delivered → reached
  {
    id: 'attempt-007',
    citizenId: 'C004',
    channel: 'SMS',
    deliveryStatus: 'DELIVERED',
    occurredAt: new Date('2026-08-01T06:00:00.000Z'),
    districtId: 'district-kelani',
    hazardType: 'FLOOD',
    alertId: 'alert-001',
    attemptAt: new Date('2026-08-01T06:01:00.000Z'),
  },
]
