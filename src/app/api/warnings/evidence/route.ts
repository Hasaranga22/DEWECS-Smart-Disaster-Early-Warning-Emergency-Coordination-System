import { NextResponse } from 'next/server';
import { getUc1Module } from '@/modules/uc1-warning/container';
import type { VerifiedEvidence } from '@/modules/uc1-warning/ports/types';
import { getActor, requireRole } from '@/shared/access';
import { D } from '@/shared/seed';
import { handleApiError } from '../errorHandler';

// Seeded sample verified evidence reports from UC2
const SAMPLE_VERIFIED_EVIDENCE: VerifiedEvidence[] = [
  {
    reportId: 'rep-001',
    hazardType: 'FLOOD',
    districtId: D.COLOMBO,
    lat: 6.9271,
    lng: 79.8612,
    severityIndication: 'HIGH',
    confidence: 'FULL',
    corroborationCount: 4,
    decidedAt: new Date('2026-10-08T09:30:00.000Z'),
    occurredAt: new Date('2026-10-08T09:00:00.000Z'),
  },
  {
    reportId: 'rep-002',
    hazardType: 'LANDSLIDE',
    districtId: D.KEGALLE,
    lat: 7.2513,
    lng: 80.3464,
    severityIndication: 'MEDIUM',
    confidence: 'FULL',
    corroborationCount: 2,
    decidedAt: new Date('2026-10-08T08:45:00.000Z'),
    occurredAt: new Date('2026-10-08T08:15:00.000Z'),
  },
];

export async function GET(request: Request) {
  try {
    const actor = await getActor(request);
    requireRole(actor, ['DMC_OFFICIAL', 'DUTY_OFFICER']);

    const uc1 = getUc1Module();
    if (uc1.evidenceProvider) {
      const live = await uc1.evidenceProvider.listVerified();
      return NextResponse.json(live);
    }

    return NextResponse.json(SAMPLE_VERIFIED_EVIDENCE);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
