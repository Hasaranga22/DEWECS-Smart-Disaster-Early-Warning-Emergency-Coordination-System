import { NextResponse } from 'next/server';
import { getUc1Module } from '@/modules/uc1-warning/container';
import { getActor, requireRole } from '@/shared/access';
import { handleApiError } from '../errorHandler';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = getActor(request);
    requireRole(actor, ['DMC_OFFICIAL', 'DUTY_OFFICER', 'DISTRICT_OFFICER', 'CITIZEN']);

    const { id } = await params;
    const uc1 = getUc1Module();
    const alert = await uc1.alertRepo.findById(id);

    if (!alert) {
      return NextResponse.json({ error: `Alert with ID ${id} not found` }, { status: 404 });
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
        title: alert.title ?? null,
        hazardType: alert.hazardType,
        severity: alert.severity,
        status: alert.status,
        message: alert.message,
        target: alert.target,
        issuedBy: alert.issuedBy,
        occurredAt: alert.occurredAt.toISOString(),
        expiresAt: alert.expiresAt?.toISOString() ?? null,
        cancelledAt: alert.cancelledAt?.toISOString() ?? null,
        cancellationReason: alert.cancellationReason,
        escalations: alert.escalations.map((e) => ({
          id: e.id,
          fromSeverity: e.fromSeverity,
          toSeverity: e.toSeverity,
          occurredAt: e.occurredAt.toISOString(),
          byOfficerId: e.byOfficerId,
          reason: e.reason,
        })),
      },
      distinctCitizensReached: deliveredCitizenIds.size,
      totalAttempts: attempts.length,
      channelSummary: {
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
        alertId: a.alertId,
        citizenId: a.citizenId,
        districtId: a.districtId,
        hazardType: a.hazardType,
        channel: a.channel,
        status: a.status,
        kind: a.kind,
        occurredAt: a.occurredAt.toISOString(),
        sentAt: a.sentAt?.toISOString() ?? null,
        deliveredAt: a.deliveredAt?.toISOString() ?? null,
        failureReason: a.failureReason,
      })),
    });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
