'use client';

import React, { useState } from 'react';
import type { AttemptItem } from '../lib/types';
import type { Role } from '@/shared/domain';
import { getDistrictName } from '../lib/helpers';

interface AttemptsTableProps {
  attempts: AttemptItem[];
  actorRole?: Role;
}

export function AttemptsTable({ attempts, actorRole }: AttemptsTableProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Only render toggle and full log for DMC_OFFICIAL and DUTY_OFFICER
  const isAuthorizedRole = actorRole === 'DMC_OFFICIAL' || actorRole === 'DUTY_OFFICER';
  if (!isAuthorizedRole || attempts.length === 0) {
    return null;
  }

  // Group attempts by district
  const byDistrict = new Map<string, AttemptItem[]>();
  for (const att of attempts) {
    const list = byDistrict.get(att.districtId) || [];
    list.push(att);
    byDistrict.set(att.districtId, list);
  }

  const districtEntries = Array.from(byDistrict.entries());

  return (
    <div className="w-full space-y-4 pt-2">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-lg border-2 border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100 shadow-sm cursor-pointer transition"
      >
        <span>{isExpanded ? '▼ Hide full attempt log' : `▶ View full attempt log (${attempts.length} attempts)`}</span>
      </button>

      {isExpanded && (
        <div className="rounded-xl border-2 border-slate-200 bg-white p-5 shadow-sm space-y-4 w-full">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Notification Attempts Log</h3>
              <p className="text-xs text-slate-600 font-medium">
                Detailed per-attempt delivery audit grouped by targeted district
              </p>
            </div>
            <span className="text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 rounded px-2.5 py-1">
              {attempts.length} attempts across {districtEntries.length} districts
            </span>
          </div>

          <div className="space-y-3">
            {districtEntries.map(([districtId, distAttempts]) => (
              <details
                key={districtId}
                open
                className="group rounded-lg border border-slate-200 bg-slate-50 overflow-hidden"
              >
                <summary className="flex cursor-pointer items-center justify-between bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-900 select-none hover:bg-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-mono">▸</span>
                    <span>{getDistrictName(districtId)} District</span>
                  </div>
                  <span className="font-semibold text-slate-600 font-mono text-[11px]">
                    {distAttempts.length} attempt{distAttempts.length > 1 ? 's' : ''}
                  </span>
                </summary>

                <div className="p-2 overflow-x-auto bg-white">
                  <table className="w-full text-left text-xs min-w-[600px]">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Citizen (Short ID)</th>
                        <th className="p-2.5">Channel</th>
                        <th className="p-2.5">Kind</th>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5">Failure / Delivery Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {distAttempts.map((att) => (
                        <tr key={att.id} className="hover:bg-slate-50">
                          <td className="p-2.5">
                            <span className="font-mono font-bold text-slate-900">
                              ...{att.citizenId.slice(-6)}
                            </span>
                          </td>
                          <td className="p-2.5 font-bold text-slate-900">{att.channel}</td>
                          <td className="p-2.5 text-slate-800">{att.kind}</td>
                          <td className="p-2.5">
                            <span
                              className={`rounded px-2.5 py-0.5 text-[11px] font-bold ${
                                att.status === 'DELIVERED'
                                  ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                                  : att.status === 'FAILED'
                                  ? 'bg-red-100 text-red-950 border border-red-300'
                                  : 'bg-slate-200 text-slate-800'
                              }`}
                            >
                              {att.status}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-700">{att.failureReason ?? '–'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
