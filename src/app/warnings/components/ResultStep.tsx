import React from 'react';
import Link from 'next/link';
import type { DispatchResultData } from '../lib/types';
import { AttemptsTable } from './AttemptsTable';

interface ResultStepProps {
  dispatchResult: DispatchResultData;
  onRetry: (alertId: string) => void;
  onResetToActiveList: () => void;
  loading: boolean;
}

export function ResultStep({
  dispatchResult,
  onRetry,
  onResetToActiveList,
  loading,
}: ResultStepProps) {
  const deliveredTotal =
    dispatchResult.channelSummary.sms.delivered + dispatchResult.channelSummary.push.delivered;
  const failedTotal =
    dispatchResult.channelSummary.sms.failed + dispatchResult.channelSummary.push.failed;

  return (
    <div className="space-y-6 rounded-xl border-2 border-slate-200 bg-white p-6 shadow-sm w-full">
      <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-5 text-emerald-950 shadow-sm w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-xl font-black">Alert Dispatched Successfully</h2>
            {dispatchResult.alert.title && (
              <p className="mt-1 text-sm font-extrabold text-emerald-950">
                {dispatchResult.alert.title}
              </p>
            )}
            <p className="mt-1 text-sm font-medium">
              Active alert registered (ID:{' '}
              <span className="font-mono font-bold">{dispatchResult.alert.id}</span>).
              Saved to database before gateway dispatch.
            </p>
          </div>
          <span className="rounded-full bg-emerald-200 px-3 py-1 text-xs font-black text-emerald-900 border border-emerald-400 self-start sm:self-center">
            COMMITTED & DISPATCHED
          </span>
        </div>
      </div>

      {/* Stat cards in a row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
        <div className="rounded-xl border-2 border-slate-200 bg-white p-5 text-center shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Distinct Citizens Reached
          </span>
          <p className="mt-2 text-4xl font-black text-emerald-700">
            {dispatchResult.distinctCitizensReached}
          </p>
          <span className="mt-1 block text-xs font-semibold text-slate-600">
            Confirmed delivered to ≥1 channel
          </span>
        </div>

        <div className="rounded-xl border-2 border-slate-200 bg-white p-5 text-center shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Delivered Attempts
          </span>
          <p className="mt-2 text-4xl font-black text-slate-900">{deliveredTotal}</p>
          <span className="mt-1 block text-xs font-semibold text-slate-600">
            SMS: {dispatchResult.channelSummary.sms.delivered} | Push: {dispatchResult.channelSummary.push.delivered}
          </span>
        </div>

        <div className="rounded-xl border-2 border-slate-200 bg-white p-5 text-center shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Failed Attempts
          </span>
          <p
            className={`mt-2 text-4xl font-black ${
              failedTotal > 0 ? 'text-red-700' : 'text-slate-900'
            }`}
          >
            {failedTotal}
          </p>
          <span className="mt-1 block text-xs font-semibold text-slate-600">
            SMS: {dispatchResult.channelSummary.sms.failed} | Push: {dispatchResult.channelSummary.push.failed}
          </span>
        </div>
      </div>

      {/* Attempts Table */}
      {dispatchResult.attempts && dispatchResult.attempts.length > 0 && (
        <AttemptsTable attempts={dispatchResult.attempts} />
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200 w-full">
        <div className="flex gap-2.5">
          {failedTotal > 0 && (
            <button
              type="button"
              onClick={() => onRetry(dispatchResult.alert.id)}
              disabled={loading}
              className="rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50 cursor-pointer shadow-sm"
            >
              {loading ? 'Retrying...' : 'Retry Failed Attempts'}
            </button>
          )}
          <Link
            href={`/alerts/${dispatchResult.alert.id}`}
            className="rounded-lg border-2 border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-100 shadow-sm"
          >
            View Citizen Receipt (Mobile View) →
          </Link>
        </div>

        <button
          type="button"
          onClick={onResetToActiveList}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 shadow-sm cursor-pointer"
        >
          View in Active Alerts List
        </button>
      </div>
    </div>
  );
}
