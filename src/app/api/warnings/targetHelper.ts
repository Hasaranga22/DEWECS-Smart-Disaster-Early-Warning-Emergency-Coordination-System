import { D, RIVER_BASINS } from '@/shared/seed';

export interface AlertLike {
  target: {
    districtIds?: string[] | readonly string[];
    basinId?: string;
  };
  escalations?: ReadonlyArray<unknown>;
}

/**
 * Resolves the district assigned to a District Officer,
 * giving priority to an x-district-id override header, then the actor's districtId,
 * and falling back to D.COLOMBO.
 */
export function resolveOfficerDistrict(
  request: Request,
  actor: { districtId?: string },
): string {
  return request.headers.get('x-district-id') || actor.districtId || D.COLOMBO;
}

/**
 * Determines whether a hazard alert targets the specified district:
 * 1. Directly in alert.target.districtIds
 * 2. Via alert.target.basinId (if the river basin contains the district)
 * 3. Via any escalation expansions (expandDistrictIds or expandBasinId)
 * 4. Via any recorded notification attempts for that district
 */
export function isAlertTargetingDistrict(
  alert: AlertLike,
  districtId: string,
  attempts?: Array<{ districtId: string }>,
): boolean {
  // 1. Direct district target
  if (alert.target.districtIds && alert.target.districtIds.includes(districtId)) {
    return true;
  }

  // 2. Target river basin
  if (alert.target.basinId) {
    const basin = RIVER_BASINS.find((b) => b.id === alert.target.basinId);
    if (basin && basin.districtIds.includes(districtId)) {
      return true;
    }
  }

  // 3. Escalation expansions if present on escalations
  if (alert.escalations) {
    for (const rawEsc of alert.escalations) {
      if (rawEsc && typeof rawEsc === 'object') {
        const esc = rawEsc as { expandDistrictIds?: string[]; expandBasinId?: string };
        if (esc.expandDistrictIds && esc.expandDistrictIds.includes(districtId)) {
          return true;
        }
        if (esc.expandBasinId) {
          const basin = RIVER_BASINS.find((b) => b.id === esc.expandBasinId);
          if (basin && basin.districtIds.includes(districtId)) {
            return true;
          }
        }
      }
    }
  }

  // 4. Notification attempts in the given district
  if (attempts && attempts.some((a) => a.districtId === districtId)) {
    return true;
  }

  return false;
}

/**
 * Aggregates notification attempts into totals and channel summaries.
 */
export function summarizeAttempts(
  attempts: Array<{ channel: string; status: string; citizenId: string }>,
) {
  const smsAttempts = attempts.filter((a) => a.channel === 'SMS');
  const pushAttempts = attempts.filter((a) => a.channel === 'PUSH');
  const deliveredCitizenIds = new Set(
    attempts.filter((a) => a.status === 'DELIVERED').map((a) => a.citizenId),
  );

  return {
    totalAttempts: attempts.length,
    distinctCitizensReached: deliveredCitizenIds.size,
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
  };
}
