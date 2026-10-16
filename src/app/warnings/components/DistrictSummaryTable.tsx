import React from 'react';
import type { AttemptItem } from '../lib/types';
import type { Role } from '@/shared/domain';
import { getDistrictName } from '../lib/helpers';
import { D, RIVER_BASINS } from '@/shared/seed';

interface DistrictSummaryTableProps {
  attempts: AttemptItem[];
  target?: { districtIds?: string[]; basinId?: string };
  distinctCitizensReached: number;
  actorRole?: Role;
  actorDistrictId?: string;
}

interface DistrictRow {
  districtId: string;
  districtName: string;
  targetedCount: number;
  reachedCount: number;
  smsDelivered: number;
  smsFailed: number;
  pushDelivered: number;
  pushFailed: number;
  notReachedCount: number;
  ratePercent: number;
}

export function DistrictSummaryTable({
  attempts,
  target,
  distinctCitizensReached,
  actorRole,
  actorDistrictId,
}: DistrictSummaryTableProps) {
  let targetedDistrictIds: string[] = [];
  if (target?.districtIds && target.districtIds.length > 0) {
    targetedDistrictIds = [...target.districtIds];
  } else if (target?.basinId) {
    const basin = RIVER_BASINS.find((b) => b.id === target.basinId);
    if (basin) targetedDistrictIds = [...basin.districtIds];
  }

  for (const att of attempts) {
    if (att.districtId && !targetedDistrictIds.includes(att.districtId)) {
      targetedDistrictIds.push(att.districtId);
    }
  }

  const officerDistrict = actorDistrictId || D.COLOMBO;
  if (actorRole === 'DISTRICT_OFFICER') {
    targetedDistrictIds = targetedDistrictIds.filter((dId) => dId === officerDistrict);
    if (targetedDistrictIds.length === 0) {
      targetedDistrictIds = [officerDistrict];
    }
  }

  const rows: DistrictRow[] = targetedDistrictIds.map((distId) => {
    const distAttempts = attempts.filter((a) => a.districtId === distId);
    const citizenIds = Array.from(new Set(distAttempts.map((a) => a.citizenId)));
    const targetedCount = citizenIds.length;

    const reachedCitizenIds = citizenIds.filter((cId) =>
      distAttempts.some((a) => a.citizenId === cId && a.status === 'DELIVERED'),
    );
    const reachedCount = reachedCitizenIds.length;
    const notReachedCount = targetedCount - reachedCount;

    const smsDelivered = distAttempts.filter((a) => a.channel === 'SMS' && a.status === 'DELIVERED').length;
    const smsFailed = distAttempts.filter((a) => a.channel === 'SMS' && a.status === 'FAILED').length;
    const pushDelivered = distAttempts.filter((a) => a.channel === 'PUSH' && a.status === 'DELIVERED').length;
    const pushFailed = distAttempts.filter((a) => a.channel === 'PUSH' && a.status === 'FAILED').length;

    const ratePercent = targetedCount > 0 ? Math.round((reachedCount / targetedCount) * 100) : 0;

    return {
      districtId: distId,
      districtName: getDistrictName(distId),
      targetedCount,
      reachedCount,
      smsDelivered,
      smsFailed,
      pushDelivered,
      pushFailed,
      notReachedCount,
      ratePercent,
    };
  });

  const totalTargeted = rows.reduce((acc, r) => acc + r.targetedCount, 0);
  const totalReached = actorRole === 'DISTRICT_OFFICER'
    ? rows.reduce((acc, r) => acc + r.reachedCount, 0)
    : distinctCitizensReached;
  const totalSmsDelivered = rows.reduce((acc, r) => acc + r.smsDelivered, 0);
  const totalSmsFailed = rows.reduce((acc, r) => acc + r.smsFailed, 0);
  const totalPushDelivered = rows.reduce((acc, r) => acc + r.pushDelivered, 0);
  const totalPushFailed = rows.reduce((acc, r) => acc + r.pushFailed, 0);
  const totalNotReached = rows.reduce((acc, r) => acc + r.notReachedCount, 0);
  const totalRatePercent = totalTargeted > 0 ? Math.round((totalReached / totalTargeted) * 100) : 0;

  return (
    <div className="rounded-xl border-2 border-slate-200 bg-white p-5 shadow-sm space-y-3 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-extrabold text-slate-900">District Delivery Summary</h3>
          <p className="text-xs text-slate-600 font-medium">
            Aggregated delivery breakdown across targeted districts
            {actorRole === 'DISTRICT_OFFICER' && ' (Filtered to your assigned district)'}
          </p>
        </div>
        <span className="text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 rounded px-2.5 py-1">
          {rows.length} {rows.length === 1 ? 'District' : 'Districts'}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border-2 border-slate-200 w-full">
        <table className="w-full text-left text-xs min-w-[750px]">
          <thead className="bg-slate-200 text-slate-900 font-extrabold">
            <tr>
              <th className="p-3">District</th>
              <th className="p-3 text-right">Targeted</th>
              <th className="p-3 text-right">Reached</th>
              <th className="p-3 text-right">SMS Del.</th>
              <th className="p-3 text-right">SMS Fail</th>
              <th className="p-3 text-right">Push Del.</th>
              <th className="p-3 text-right">Push Fail</th>
              <th className="p-3 text-right">Not Reached</th>
              <th className="p-3 min-w-[130px]">Progress</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {rows.map((row) => (
              <tr key={row.districtId} className="hover:bg-slate-50 font-medium text-slate-900">
                <td className="p-3 font-bold">{row.districtName}</td>
                <td className="p-3 text-right font-mono">{row.targetedCount}</td>
                <td className="p-3 text-right font-mono font-bold text-emerald-700">{row.reachedCount}</td>
                <td className="p-3 text-right font-mono text-emerald-800">{row.smsDelivered}</td>
                <td className="p-3 text-right font-mono text-red-700">{row.smsFailed}</td>
                <td className="p-3 text-right font-mono text-emerald-800">{row.pushDelivered}</td>
                <td className="p-3 text-right font-mono text-red-700">{row.pushFailed}</td>
                <td className="p-3 text-right font-mono font-bold text-amber-800">{row.notReachedCount}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full ${
                          row.ratePercent === 100
                            ? 'bg-emerald-600'
                            : row.ratePercent > 0
                            ? 'bg-blue-600'
                            : 'bg-slate-300'
                        }`}
                        style={{ width: `${row.ratePercent}%` }}
                      />
                    </div>
                    <span className="font-mono text-[11px] font-bold text-slate-700">
                      {row.ratePercent}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-extrabold text-slate-900">
            <tr>
              <td className="p-3 uppercase tracking-wider text-[11px]">Total</td>
              <td className="p-3 text-right font-mono">{totalTargeted}</td>
              <td className="p-3 text-right font-mono text-emerald-800 text-sm">{totalReached}</td>
              <td className="p-3 text-right font-mono text-emerald-800">{totalSmsDelivered}</td>
              <td className="p-3 text-right font-mono text-red-700">{totalSmsFailed}</td>
              <td className="p-3 text-right font-mono text-emerald-800">{totalPushDelivered}</td>
              <td className="p-3 text-right font-mono text-red-700">{totalPushFailed}</td>
              <td className="p-3 text-right font-mono text-amber-800">{totalNotReached}</td>
              <td className="p-3">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-16 overflow-hidden rounded-full bg-slate-300">
                    <div
                      className={`h-full ${
                        totalRatePercent === 100
                          ? 'bg-emerald-600'
                          : totalRatePercent > 0
                          ? 'bg-blue-600'
                          : 'bg-slate-400'
                      }`}
                      style={{ width: `${totalRatePercent}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs font-black text-slate-900">
                    {totalRatePercent}%
                  </span>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
