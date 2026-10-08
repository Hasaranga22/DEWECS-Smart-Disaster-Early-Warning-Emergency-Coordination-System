import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUc1Module } from '@/modules/uc1-warning';
import { getActor, requireRole } from '@/shared/access';
import { handleApiError } from './errorHandler';

const issueSchema = z.object({
  hazardType: z.enum(['FLOOD', 'LANDSLIDE', 'CYCLONE', 'DROUGHT']),
  severity: z.enum(['ADVISORY', 'WATCH', 'WARNING', 'EMERGENCY']),
  message: z.string().min(1, 'Warning message cannot be empty'),
  target: z.object({
    districtIds: z.array(z.string()).optional(),
    basinId: z.string().optional(),
  }),
  confirmZeroRecipients: z.boolean().optional(),
  expiresAt: z.string().datetime().optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const actor = getActor(request);
    requireRole(actor, ['DMC_OFFICIAL']);

    const body = await request.json();
    const parsed = issueSchema.parse(body);

    const uc1 = getUc1Module();
    const result = await uc1.warningService.issue({
      hazardType: parsed.hazardType,
      severity: parsed.severity,
      message: parsed.message,
      target: parsed.target,
      issuedBy: actor.userId,
      confirmZeroRecipients: parsed.confirmZeroRecipients,
      expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
    });

    return NextResponse.json(
      {
        alert: {
          id: result.alert.id,
          hazardType: result.alert.hazardType,
          severity: result.alert.severity,
          status: result.alert.status,
          message: result.alert.message,
          target: result.alert.target,
          occurredAt: result.alert.occurredAt.toISOString(),
          expiresAt: result.alert.expiresAt?.toISOString() ?? null,
          cancelledAt: result.alert.cancelledAt?.toISOString() ?? null,
          escalations: result.alert.escalations,
        },
        distinctCitizensReached: result.distinctCitizensReached,
        totalAttempts: result.totalAttempts,
        channelSummary: result.channelSummary,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(request: Request) {
  try {
    const actor = getActor(request);
    requireRole(actor, ['DMC_OFFICIAL', 'DUTY_OFFICER', 'DISTRICT_OFFICER']);

    const { searchParams } = new URL(request.url);
    const districtId = searchParams.get('districtId') ?? undefined;
    const hazardTypeParam = searchParams.get('hazardType');
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    const uc1 = getUc1Module();
    // First expire any due alerts
    await uc1.warningService.expireDueAlerts();

    const alerts = await uc1.queryService.listAlerts({
      districtId,
      hazardType: hazardTypeParam ? (hazardTypeParam as any) : undefined,
      from: fromParam ? new Date(fromParam) : undefined,
      to: toParam ? new Date(toParam) : undefined,
    });

    // Enrich with attempts stats
    const enriched = await Promise.all(
      alerts.map(async (alert) => {
        const attempts = await uc1.alertRepo.findAttemptsByAlertId(alert.id);
        const delivered = attempts.filter((a) => a.status === 'DELIVERED').length;
        const failed = attempts.filter((a) => a.status === 'FAILED').length;
        const distinctCitizens = new Set(
          attempts.filter((a) => a.status === 'DELIVERED').map((a) => a.citizenId),
        ).size;

        return {
          id: alert.id,
          hazardType: alert.hazardType,
          severity: alert.severity,
          status: alert.status,
          message: alert.message,
          target: alert.target,
          occurredAt: alert.occurredAt.toISOString(),
          expiresAt: alert.expiresAt?.toISOString() ?? null,
          cancelledAt: alert.cancelledAt?.toISOString() ?? null,
          cancellationReason: alert.cancellationReason,
          escalations: alert.escalations,
          attemptsCount: attempts.length,
          deliveredCount: delivered,
          failedCount: failed,
          distinctCitizensReached: distinctCitizens,
        };
      }),
    );

    return NextResponse.json(enriched);
  } catch (error) {
    return handleApiError(error);
  }
}
