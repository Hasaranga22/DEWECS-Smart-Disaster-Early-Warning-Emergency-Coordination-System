import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUc1Module } from '@/modules/uc1-warning/container';
import { getActor, requireRole } from '@/shared/access';
import { handleApiError } from '../../errorHandler';

const cancelSchema = z.object({
  reason: z.string().trim().min(1, 'Cancellation reason is required'),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await getActor(request);
    requireRole(actor, ['DMC_OFFICIAL']);

    const { id } = await params;
    const body = await request.json();
    const validated = cancelSchema.parse(body);

    const uc1 = getUc1Module();
    const result = await uc1.warningService.cancel(id, actor.userId ?? actor.id, validated.reason);

    return NextResponse.json({
      alert: {
        id: result.alert.id,
        hazardType: result.alert.hazardType,
        severity: result.alert.severity,
        status: result.alert.status,
        message: result.alert.message,
        target: result.alert.target,
        issuedBy: result.alert.issuedBy,
        occurredAt: result.alert.occurredAt.toISOString(),
        expiresAt: result.alert.expiresAt?.toISOString() ?? null,
        cancelledAt: result.alert.cancelledAt?.toISOString() ?? null,
        cancellationReason: result.alert.cancellationReason,
      },
      distinctCitizensReached: result.distinctCitizensReached,
      totalAttempts: result.totalAttempts,
      channelSummary: result.channelSummary,
    });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
