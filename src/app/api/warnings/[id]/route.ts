import { NextResponse } from 'next/server';
import { getUc1Module } from '@/modules/uc1-warning/container';
import { getActor, requireRole } from '@/shared/access';
import { handleApiError } from '../errorHandler';
import { isAlertTargetingDistrict, resolveOfficerDistrict, summarizeAttempts } from '../targetHelper';

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

    const alertPayload = {
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
    };

    if (actor.role === 'CITIZEN') {
      return NextResponse.json({ alert: alertPayload });
    }

    const attempts = await uc1.alertRepo.findAttemptsByAlertId(id);

    let scopedAttempts = attempts;

    if (actor.role === 'DISTRICT_OFFICER') {
      const officerDistrict = resolveOfficerDistrict(request, actor);

      const isTargeted = isAlertTargetingDistrict(alert, officerDistrict, attempts);

      if (!isTargeted) {
        return NextResponse.json(
          { error: 'Access denied: Alert does not target officer district' },
          { status: 403 },
        );
      }

      scopedAttempts = attempts.filter((a) => a.districtId === officerDistrict);
    }

    const { totalAttempts, distinctCitizensReached, channelSummary } = summarizeAttempts(scopedAttempts);

    return NextResponse.json({
      alert: alertPayload,
      distinctCitizensReached,
      totalAttempts,
      channelSummary,
      attempts: scopedAttempts.map((a) => ({
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
