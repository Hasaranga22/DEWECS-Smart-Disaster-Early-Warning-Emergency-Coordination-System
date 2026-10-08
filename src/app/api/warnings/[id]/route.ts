import { NextResponse } from 'next/server';
import { getUc1Module } from '@/modules/uc1-warning';
import { getActor, requireRole } from '@/shared/access';
import { handleApiError } from '../errorHandler';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const actor = getActor(request);
    requireRole(actor, ['DMC_OFFICIAL', 'DUTY_OFFICER', 'DISTRICT_OFFICER', 'CITIZEN']);

    const uc1 = getUc1Module();
    const alert = await uc1.alertRepo.findById(id);
    if (!alert) {
      return NextResponse.json({ error: `Alert with ID ${id} not found.` }, { status: 404 });
    }

    const attempts = await uc1.alertRepo.findAttemptsByAlertId(id);
    const smsAttempts = attempts.filter((a) => a.channel === 'SMS');
    const pushAttempts = attempts.filter((a) => a.channel === 'PUSH');

    const deliveredCitizenIds = new Set(
      attempts.filter((a) => a.status === 'DELIVERED').map((a) => a.citizenId),
    );

    return NextResponse.json({
      alert: {
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
      },
      summary: {
        totalAttempts: attempts.length,
        distinctCitizensReached: deliveredCitizenIds.size,
        sms: {
          sent: smsAttempts.length,
          delivered: smsAttempts.filter((a) => a.status === 'DELIVERED').length,
          failed: smsAttempts.filter((a) => a.status === 'FAILED').length,
        },
        push: {
          sent: pushAttempts.length,
          delivered: pushAttempts.filter((a) => a.status === 'DELIVERED').length,
          failed: pushAttempts.filter((a) => a.status === 'FAILED').length,
        },
      },
      attempts: attempts.map((a) => ({
        id: a.id,
        citizenId: a.citizenId,
        districtId: a.districtId,
        channel: a.channel,
        status: a.status,
        kind: a.kind,
        occurredAt: a.occurredAt.toISOString(),
        sentAt: a.sentAt?.toISOString() ?? null,
        deliveredAt: a.deliveredAt?.toISOString() ?? null,
        failureReason: a.failureReason,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
