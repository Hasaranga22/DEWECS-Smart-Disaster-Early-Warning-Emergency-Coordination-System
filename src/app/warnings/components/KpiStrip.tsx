import React from 'react';
import type { DispatchResultData } from '../lib/types';

interface KpiStripProps {
  activeCount: number;
  escalatedCount: number;
  closedCount: number;
  cancelledCount?: number;
  expiredCount?: number;
  citizensReachedInLast: number;
  dispatchResult: DispatchResultData | null;
  hasAlerts: boolean;
}

export function KpiStrip({
  activeCount,
  escalatedCount,
  closedCount,
  cancelledCount,
  expiredCount,
  citizensReachedInLast,
  dispatchResult,
  hasAlerts,
}: KpiStripProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 w-full">
      <div className="rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-600">
          <span>Active Warnings</span>
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
        </div>
        <p className="mt-2 text-3xl font-black text-slate-900">{activeCount}</p>
        <span className="text-xs text-slate-600 font-medium">Currently active bulletins</span>
      </div>

      <div className="rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-600">
          <span>Escalated Warnings</span>
          <span className="h-2.5 w-2.5 rounded-full bg-purple-500 ring-2 ring-purple-200" />
        </div>
        <p className="mt-2 text-3xl font-black text-purple-700">{escalatedCount}</p>
        <span className="text-xs text-slate-600 font-medium">Higher severity level</span>
      </div>

      <div className="rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-600">
          <span>Cancelled / Expired</span>
          <span className="h-2.5 w-2.5 rounded-full bg-slate-400 ring-2 ring-slate-200" />
        </div>
        <p className="mt-2 text-3xl font-black text-slate-700">{closedCount}</p>
        <span className="text-xs text-slate-600 font-medium">
          {cancelledCount !== undefined && expiredCount !== undefined
            ? `${cancelledCount} Cancelled • ${expiredCount} Expired`
            : 'Resolved warning events'}
        </span>
      </div>

      <div className="rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-600">
          <span>Citizens Reached (Last)</span>
          <span className="h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-blue-200" />
        </div>
        <p className="mt-2 text-3xl font-black text-blue-700">{citizensReachedInLast}</p>
        <span className="text-xs text-slate-600 font-medium">
          {dispatchResult ? 'Confirmed delivered' : hasAlerts ? 'Prior alert' : 'No alerts dispatched'}
        </span>
      </div>
    </div>
  );
}
