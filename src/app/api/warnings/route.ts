import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUc1Module } from '@/modules/uc1-warning/container';
import { getActor, requireRole } from '@/shared/access';
import { handleApiError } from './errorHandler';
import { isAlertTargetingDistrict, resolveOfficerDistrict, summarizeAttempts } from './targetHelper';

const issueSchema = z
  .object({
    title: z.string().trim().max(80, 'Custom title cannot exceed 80 characters').optional().nullable(),
    hazardType: z.enum(['FLOOD', 'LANDSLIDE', 'CYCLONE', 'DROUGHT']),
    severity: z.enum(['ADVISORY', 'WATCH', 'WARNING', 'EMERGENCY']),
    message: z.string().trim().min(1, 'Message is required'),
    target: z
      .object({
        districtIds: z.array(z.string()).optional(),
        basinId: z.string().optional(),
      })
      .refine(
        (t) => (t.districtIds && t.districtIds.length > 0) || Boolean(t.basinId),
        {
          message: 'Target must contain at least one district or a basin ID',
        },
      ),
    confirmZeroRecipients: z.boolean().optional(),
    expiresAt: z.string().datetime().optional().nullable(),
  });

export async function POST(request: Request) {
  try {
    const actor = getActor(request);
    requireRole(actor, ['DMC_OFFICIAL']);

    const body = await request.json();
    const validated = issueSchema.parse(body);

    const uc1 = getUc1Module();
    const result = await uc1.warningService.issue({
      title: validated.title ? validated.title : undefined,
      hazardType: validated.hazardType,
      severity: validated.severity,
      message: validated.message,
      target: validated.target,
      issuedBy: actor.userId,
      confirmZeroRecipients: validated.confirmZeroRecipients,
      expiresAt: validated.expiresAt ? new Date(validated.expiresAt) : null,
    });

    return NextResponse.json(
      {
        alert: {
          id: result.alert.id,
          title: result.alert.title ?? null,
          hazardType: result.alert.hazardType,
          severity: result.alert.severity,
          status: result.alert.status,
          message: result.alert.message,
          target: result.alert.target,
          issuedBy: result.alert.issuedBy,
          occurredAt: result.alert.occurredAt.toISOString(),
          expiresAt: result.alert.expiresAt?.toISOString() ?? null,
          cancelledAt: result.alert.cancelledAt?.toISOString() ?? null,
        },
        distinctCitizensReached: result.distinctCitizensReached,
        totalAttempts: result.totalAttempts,
        channelSummary: result.channelSummary,
        attempts: result.attempts.map((a) => ({
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
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export async function GET(request: Request) {
  try {
    const actor = getActor(request);
    requireRole(actor, ['DMC_OFFICIAL', 'DUTY_OFFICER', 'DISTRICT_OFFICER']);

    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const districtId = searchParams.get('districtId') ?? undefined;
    const hazardTypeParam = searchParams.get('hazardType');

    const uc1 = getUc1Module();
    const alerts = await uc1.queryService.listAlerts({
      from: fromParam ? new Date(fromParam) : undefined,
      to: toParam ? new Date(toParam) : undefined,
      districtId,
      hazardType: hazardTypeParam ? (hazardTypeParam as import('@/shared/domain').HazardType) : undefined,
    });

    const isDistrictOfficer = actor.role === 'DISTRICT_OFFICER';
    const officerDistrict = isDistrictOfficer ? resolveOfficerDistrict(request, actor) : undefined;

    const enrichedAlerts = [];

    for (const a of alerts) {
      const attempts = await uc1.alertRepo.findAttemptsByAlertId(a.id);

      if (isDistrictOfficer) {
        if (!isAlertTargetingDistrict(a, officerDistrict!, attempts)) {
          continue;
        }
      }

      const scopedAttempts = isDistrictOfficer
        ? attempts.filter((att) => att.districtId === officerDistrict)
        : attempts;

      const { totalAttempts, distinctCitizensReached, channelSummary } = summarizeAttempts(scopedAttempts);

      enrichedAlerts.push({
        id: a.id,
        title: a.title ?? null,
        hazardType: a.hazardType,
        severity: a.severity,
        status: a.status,
        message: a.message,
        target: a.target,
        issuedBy: a.issuedBy,
        occurredAt: a.occurredAt.toISOString(),
        expiresAt: a.expiresAt?.toISOString() ?? null,
        cancelledAt: a.cancelledAt?.toISOString() ?? null,
        cancellationReason: a.cancellationReason,
        escalations: a.escalations.map((e) => ({
          id: e.id,
          fromSeverity: e.fromSeverity,
          toSeverity: e.toSeverity,
          occurredAt: e.occurredAt.toISOString(),
          byOfficerId: e.byOfficerId,
          reason: e.reason,
        })),
        totalAttempts,
        attemptsCount: totalAttempts,
        distinctCitizensReached,
        channelSummary,
      });
    }

    return NextResponse.json(enrichedAlerts);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
