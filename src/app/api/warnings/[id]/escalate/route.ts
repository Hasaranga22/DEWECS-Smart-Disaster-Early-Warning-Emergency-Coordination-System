import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUc1Module } from '@/modules/uc1-warning';
import { getActor, requireRole } from '@/shared/access';
import { handleApiError } from '../../errorHandler';

const escalateSchema = z.object({
  newSeverity: z.enum(['ADVISORY', 'WATCH', 'WARNING', 'EMERGENCY']),
  reason: z.string().optional(),
  expandDistrictIds: z.array(z.string()).optional(),
  expandBasinId: z.string().optional(),
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
    const parsed = escalateSchema.parse(body);

    const uc1 = getUc1Module();
    const result = await uc1.warningService.escalate({
      alertId: id,
      newSeverity: parsed.newSeverity,
      byOfficerId: actor.userId,
      reason: parsed.reason,
      expandDistrictIds: parsed.expandDistrictIds,
      expandBasinId: parsed.expandBasinId,
    });

    return NextResponse.json({
      alert: {
        id: result.alert.id,
        severity: result.alert.severity,
        status: result.alert.status,
        target: result.alert.target,
        escalations: result.alert.escalations,
      },
      distinctCitizensReached: result.distinctCitizensReached,
      totalAttempts: result.totalAttempts,
      channelSummary: result.channelSummary,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
