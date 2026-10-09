import { NextResponse } from 'next/server';
import { getUc1Module } from '@/modules/uc1-warning/container';
import { getActor, requireRole } from '@/shared/access';
import { handleApiError } from '../../errorHandler';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = getActor(request);
    requireRole(actor, ['DMC_OFFICIAL']);

    const { id } = await params;
    const uc1 = getUc1Module();
    const result = await uc1.warningService.retryFailed(id);

    return NextResponse.json({
      alert: {
        id: result.alert.id,
        hazardType: result.alert.hazardType,
        severity: result.alert.severity,
        status: result.alert.status,
      },
      distinctCitizensReached: result.distinctCitizensReached,
      totalAttempts: result.totalAttempts,
      channelSummary: result.channelSummary,
      attempts: result.attempts.map((a) => ({
        id: a.id,
        channel: a.channel,
        status: a.status,
        failureReason: a.failureReason,
      })),
    });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
