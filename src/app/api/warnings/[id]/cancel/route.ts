import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUc1Module } from '@/modules/uc1-warning';
import { getActor, requireRole } from '@/shared/access';
import { handleApiError } from '../../errorHandler';

const cancelSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required'),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const actor = getActor(request);
    requireRole(actor, ['DMC_OFFICIAL']);

    const body = await request.json();
    const parsed = cancelSchema.parse(body);

    const uc1 = getUc1Module();
    const result = await uc1.warningService.cancel(id, actor.userId, parsed.reason);

    return NextResponse.json({
      alert: {
        id: result.alert.id,
        status: result.alert.status,
        cancelledAt: result.alert.cancelledAt?.toISOString() ?? null,
        cancellationReason: result.alert.cancellationReason,
      },
      distinctCitizensReached: result.distinctCitizensReached,
      totalAttempts: result.totalAttempts,
      channelSummary: result.channelSummary,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
