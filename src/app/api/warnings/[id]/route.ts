import { NextResponse } from 'next/server';
import { getUc1Module } from '@/modules/uc1-warning/container';
import { getActor, requireRole } from '@/shared/access';
import { D, RIVER_BASINS } from '@/shared/seed';
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
      const officerDistrict = request.headers.get('x-district-id') || actor.districtId || D.COLOMBO;

      const targetDistricts = new Set<string>();
      if (alert.target.districtIds) {
        for (const d of alert.target.districtIds) targetDistricts.add(d);
      }
      if (alert.target.basinId) {
        const basin = RIVER_BASINS.find((b) => b.id === alert.target.basinId);
        if (basin) {
          for (const d of basin.districtIds) targetDistricts.add(d);
        }
      }

      const isTargeted =
        targetDistricts.has(officerDistrict) ||
        attempts.some((a) => a.districtId === officerDistrict);

      if (!isTargeted) {
        return NextResponse.json(
          { error: 'Access denied: Alert does not target officer district' },
          { status: 403 },
        );
      }

      scopedAttempts = attempts.filter((a) => a.districtId === officerDistrict);
    }

    const smsAttempts = scopedAttempts.filter((a) => a.channel === 'SMS');
    const pushAttempts = scopedAttempts.filter((a) => a.channel === 'PUSH');
    const deliveredCitizenIds = new Set(
      scopedAttempts.filter((a) => a.status === 'DELIVERED').map((a) => a.citizenId),
    );

    return NextResponse.json({
      alert: alertPayload,


      distinctCitizensReached: deliveredCitizenIds.size,
      totalAttempts: scopedAttempts.length,
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
