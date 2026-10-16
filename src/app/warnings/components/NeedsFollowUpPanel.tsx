import React from 'react';
import type { AttemptItem } from '../lib/types';
import type { Role } from '@/shared/domain';
import { getDistrictName } from '../lib/helpers';
import { D } from '@/shared/seed';

interface NeedsFollowUpPanelProps {
  attempts: AttemptItem[];
  actorRole?: Role;
  actorDistrictId?: string;
}

interface UnreachedCitizen {
  shortId: string;
  failureReason: string;
}

export function NeedsFollowUpPanel({
  attempts,
  actorRole,
  actorDistrictId,
}: NeedsFollowUpPanelProps) {
  const officerDistrict = actorDistrictId || D.COLOMBO;
  const relevantAttempts =
    actorRole === 'DISTRICT_OFFICER'
      ? attempts.filter((a) => a.districtId === officerDistrict)
      : attempts;

  const deliveredCitizenIds = new Set(
    relevantAttempts.filter((a) => a.status === 'DELIVERED').map((a) => a.citizenId),
  );

  const unreachedCitizenIds = Array.from(
    new Set(
      relevantAttempts
        .map((a) => a.citizenId)
        .filter((cId) => !deliveredCitizenIds.has(cId)),
    ),
  );

  const byDistrict = new Map<string, UnreachedCitizen[]>();

  for (const cId of unreachedCitizenIds) {
    const cAttempts = relevantAttempts.filter((a) => a.citizenId === cId);
    const distId = cAttempts[0]?.districtId || 'unknown';
    const reasons = Array.from(
      new Set(cAttempts.map((a) => a.failureReason).filter(Boolean)),
    );
    const failureReason = reasons.join(', ') || 'Delivery failed / Unreachable';

    const list = byDistrict.get(distId) || [];
    list.push({
      shortId: cId.slice(-6),
      failureReason,
    });
    byDistrict.set(distId, list);
  }

  if (unreachedCitizenIds.length === 0) {
    return (
      <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4 text-emerald-950 shadow-sm flex items-center gap-2">
        <span className="text-emerald-700 font-black text-lg">✓</span>
        <span className="text-sm font-extrabold text-emerald-950">
          All targeted citizens were reached
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-amber-300 bg-amber-50/60 p-5 shadow-sm space-y-3 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
        <div className="flex items-center gap-2">
          <span className="text-amber-800 text-lg">⚠️</span>
          <h3 className="text-base font-extrabold text-slate-900">Needs Follow-Up</h3>
          <span className="rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-black text-amber-950 border border-amber-300">
            {unreachedCitizenIds.length} Unreached
          </span>
        </div>
        <p className="text-xs font-semibold text-slate-600">
          Citizens with 0 delivered attempts on all channels (require alternative action)
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from(byDistrict.entries()).map(([districtId, citizens]) => (
          <div
            key={districtId}
            className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs space-y-2"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <span className="text-xs font-bold text-slate-900">
                {getDistrictName(districtId)}
              </span>
              <span className="text-[11px] font-mono text-slate-500 font-semibold">
                {citizens.length} citizen{citizens.length > 1 ? 's' : ''}
              </span>
            </div>
            <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {citizens.map((c) => (
                <li
                  key={c.shortId}
                  className="flex items-start justify-between gap-2 text-xs rounded bg-slate-50 px-2 py-1"
                >
                  <span className="font-mono font-bold text-slate-900">...{c.shortId}</span>
                  <span className="text-[11px] font-semibold text-red-700 text-right">
                    {c.failureReason}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
