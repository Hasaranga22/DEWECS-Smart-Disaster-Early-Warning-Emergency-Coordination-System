import { NextResponse } from 'next/server';
import { getUc1Module } from '@/modules/uc1-warning';
import { getActor, requireRole } from '@/shared/access';
import { handleApiError } from '../errorHandler';

export async function GET(request: Request) {
  try {
    const actor = getActor(request);
    requireRole(actor, ['DMC_OFFICIAL', 'DUTY_OFFICER', 'DISTRICT_OFFICER']);

    const { searchParams } = new URL(request.url);
    const districtId = searchParams.get('districtId') ?? undefined;

    const uc1 = getUc1Module();
    if (!uc1.evidenceProvider) {
      return NextResponse.json([]);
    }

    const evidenceList = await uc1.evidenceProvider.listVerified(districtId);
    return NextResponse.json(evidenceList);
  } catch (error) {
    return handleApiError(error);
  }
}
