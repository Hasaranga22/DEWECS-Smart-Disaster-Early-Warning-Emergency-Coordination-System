import { NextResponse } from 'next/server';
import { getUc1Module } from '@/modules/uc1-warning';
import { getActor, requireRole } from '@/shared/access';
import { handleApiError } from '../../errorHandler';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const actor = getActor(request);
    requireRole(actor, ['DMC_OFFICIAL']);

    const uc1 = getUc1Module();
    const result = await uc1.warningService.retryFailed(id);

    return NextResponse.json({
      alertId: id,
      retriedAttempts: result.totalAttempts,
      distinctCitizensReached: result.distinctCitizensReached,
      channelSummary: result.channelSummary,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
