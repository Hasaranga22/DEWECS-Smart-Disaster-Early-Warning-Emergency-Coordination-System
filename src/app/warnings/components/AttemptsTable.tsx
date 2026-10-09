import React from 'react';
import type { AttemptItem } from '../lib/types';
import { getCitizenName, getDistrictName, getShortId } from '../lib/helpers';

interface AttemptsTableProps {
  attempts: AttemptItem[];
}

export function AttemptsTable({ attempts }: AttemptsTableProps) {
  if (attempts.length === 0) return null;

  return (
    <div className="rounded-xl border-2 border-slate-200 bg-white p-5 shadow-sm space-y-3 w-full">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-extrabold text-slate-900">Notification Attempts Log</h3>
        <span className="text-xs text-slate-600 font-medium">
          Total attempts: {attempts.length}
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border-2 border-slate-200 w-full">
        <table className="w-full text-left text-xs min-w-[650px]">
          <thead className="bg-slate-200 text-slate-900 font-extrabold">
            <tr>
              <th className="p-3">Citizen</th>
              <th className="p-3">District</th>
              <th className="p-3">Channel</th>
              <th className="p-3">Kind</th>
              <th className="p-3">Status</th>
              <th className="p-3">Note / Failure</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {attempts.map((att) => {
              const name = getCitizenName(att.citizenId);
              const shortId = getShortId(att.citizenId);

              return (
                <tr key={att.id} className="hover:bg-slate-50 font-medium">
                  <td className="p-3">
                    {name ? (
                      <div>
                        <div className="font-bold text-slate-900">{name}</div>
                        <div className="text-[11px] font-mono text-slate-500">...{shortId}</div>
                      </div>
                    ) : (
                      <div className="font-mono text-slate-900 font-bold">...{shortId}</div>
                    )}
                  </td>
                  <td className="p-3 font-semibold text-slate-900">{getDistrictName(att.districtId)}</td>
                  <td className="p-3 font-bold text-slate-900">{att.channel}</td>
                  <td className="p-3 text-slate-800">{att.kind}</td>
                  <td className="p-3">
                    <span
                      className={`rounded px-2.5 py-0.5 font-bold ${
                        att.status === 'DELIVERED'
                          ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                          : att.status === 'FAILED'
                          ? 'bg-red-100 text-red-950 border border-red-300'
                          : 'bg-slate-200 text-slate-900'
                      }`}
                    >
                      {att.status}
                    </span>
                  </td>
                  <td className="p-3 text-slate-700">{att.failureReason ?? '–'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
