import React from 'react';
import type { HazardType, PreviewData, Severity } from '../lib/types';
import { getDistrictName } from '../lib/helpers';

interface PreviewStepProps {
  previewData: PreviewData;
  customTitle: string;
  hazardType: HazardType;
  severity: Severity;
  message: string;
  expiresInHours: string;
  confirmZero: boolean;
  onConfirmZeroChange: (val: boolean) => void;
  onIssue: () => void;
  onBackToEdit: () => void;
  loading: boolean;
}

export function PreviewStep({
  previewData,
  customTitle,
  hazardType,
  severity,
  message,
  expiresInHours,
  confirmZero,
  onConfirmZeroChange,
  onIssue,
  onBackToEdit,
  loading,
}: PreviewStepProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 w-full">
      {/* Left: 8 cols for recipient estimates and channel breakdown */}
      <div className="lg:col-span-8 space-y-6">
        <div className="border-b border-slate-200 pb-3">
          <h2 className="text-xl font-extrabold text-slate-900">2. Review Estimated Recipients</h2>
          <p className="text-sm font-medium text-slate-600">
            Pre-dispatch analysis confirming distinct population reach across SMS and Push gateways.
          </p>
        </div>

        {/* Key Estimates Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border-2 border-slate-200 bg-white p-5 text-center shadow-sm">
            <span className="text-xs font-bold uppercase text-slate-600 tracking-wider">
              Estimated Recipients
            </span>
            <p className="mt-2 text-4xl font-black text-blue-700">
              {previewData.estimatedRecipients}
            </p>
            <span className="mt-1 block text-xs font-semibold text-slate-600">Unique registered citizens</span>
          </div>

          <div className="rounded-xl border-2 border-slate-200 bg-white p-5 text-center shadow-sm">
            <span className="text-xs font-bold uppercase text-slate-600 tracking-wider">
              SMS Gateway Potential
            </span>
            <p className="mt-2 text-4xl font-black text-slate-900">
              {previewData.byChannel.sms}
            </p>
            <span className="mt-1 block text-xs font-semibold text-slate-600">Citizens with registered phone</span>
          </div>

          <div className="rounded-xl border-2 border-slate-200 bg-white p-5 text-center shadow-sm">
            <span className="text-xs font-bold uppercase text-slate-600 tracking-wider">
              Mobile Push Potential
            </span>
            <p className="mt-2 text-4xl font-black text-slate-900">
              {previewData.byChannel.push}
            </p>
            <span className="mt-1 block text-xs font-semibold text-slate-600">Citizens with active app tokens</span>
          </div>
        </div>

        {/* Gateway Channel Breakdown */}
        <div className="rounded-xl border-2 border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-2">
            Gateway Delivery Channels
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3.5">
              <span className="text-xs text-emerald-900 font-bold">Both (SMS + Push)</span>
              <p className="mt-1 text-2xl font-black text-emerald-800">{previewData.byChannel.both}</p>
              <span className="text-[11px] text-emerald-700 font-medium">Dual channel delivery</span>
            </div>
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3.5">
              <span className="text-xs text-blue-900 font-bold">SMS Only</span>
              <p className="mt-1 text-2xl font-black text-blue-800">{previewData.byChannel.sms - previewData.byChannel.both}</p>
              <span className="text-[11px] text-blue-700 font-medium">Telephony fallback</span>
            </div>
            <div className="rounded-lg bg-purple-50 border border-purple-200 p-3.5">
              <span className="text-xs text-purple-900 font-bold">Push Only</span>
              <p className="mt-1 text-2xl font-black text-purple-800">{previewData.byChannel.push - previewData.byChannel.both}</p>
              <span className="text-[11px] text-purple-700 font-medium">Data connection only</span>
            </div>
            <div className="rounded-lg bg-slate-100 border border-slate-200 p-3.5">
              <span className="text-xs text-slate-700 font-bold">No Reach</span>
              <p className="mt-1 text-2xl font-black text-slate-600">{previewData.byChannel.none}</p>
              <span className="text-[11px] text-slate-600 font-medium">No valid endpoints</span>
            </div>
          </div>
        </div>

        {/* Recipients by District */}
        <div className="rounded-xl border-2 border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-2">
            Recipients by District
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.entries(previewData.byDistrict).map(([dId, count]) => (
              <div key={dId} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs">
                <span className="font-bold text-slate-900">{getDistrictName(dId)}</span>
                <span className="font-black text-blue-700 text-sm">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Zero Recipients Warning */}
        {previewData.estimatedRecipients === 0 && (
          <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-extrabold text-base">Zero Recipients Warning</p>
            <p className="mt-1 font-medium">
              No citizens were found residing in the selected target area. To dispatch this warning
              anyway, explicit confirmation is required.
            </p>
            <label className="mt-3 flex items-center gap-2 font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={confirmZero}
                onChange={(e) => onConfirmZeroChange(e.target.checked)}
                className="h-4 w-4 rounded text-amber-600 cursor-pointer"
              />
              <span>Confirm issuing warning with zero registered citizens</span>
            </label>
          </div>
        )}
      </div>

      {/* Right: 4 cols for summary of warning & confirm/issue actions (sticky) */}
      <div className="lg:col-span-4 rounded-xl border-2 border-blue-300 bg-blue-50/70 p-6 shadow-sm space-y-5 lg:sticky lg:top-4">
        <div className="border-b border-blue-200 pb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-900">
            Dispatch Summary
          </span>
          {customTitle && (
            <h4 className="mt-1 text-sm font-black text-blue-950">
              {customTitle}
            </h4>
          )}
          <h3 className="mt-1 text-xl font-black text-slate-900">
            {hazardType} {severity}
          </h3>
        </div>

        <div className="space-y-4 text-xs">
          <div>
            <span className="font-bold text-slate-600 uppercase tracking-wider text-[11px]">Target Districts</span>
            <p className="font-extrabold text-sm text-slate-900 mt-1">
              {previewData.targetDistrictIds.map(getDistrictName).join(', ')}
            </p>
          </div>

          <div>
            <span className="font-bold text-slate-600 uppercase tracking-wider text-[11px]">Warning Message</span>
            <p className="mt-1 italic text-slate-900 bg-white p-3.5 rounded-lg border border-blue-200 font-medium leading-relaxed shadow-xs">
              &ldquo;{message}&rdquo;
            </p>
          </div>

          <div>
            <span className="font-bold text-slate-600 uppercase tracking-wider text-[11px]">Auto-Expiry</span>
            <p className="font-bold text-slate-900 mt-1">
              {expiresInHours === 'none' ? 'No auto-expiry' : `${expiresInHours} Hours`}
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-blue-200 space-y-3">
          <button
            type="button"
            onClick={onIssue}
            disabled={loading || (previewData.estimatedRecipients === 0 && !confirmZero)}
            title={
              loading
                ? 'Dispatching warning to gateways...'
                : previewData.estimatedRecipients === 0 && !confirmZero
                ? 'Cannot issue: zero recipients detected. Confirm checkbox above to proceed.'
                : 'Issue and dispatch hazard warning alert'
            }
            className="w-full rounded-lg bg-red-600 py-3.5 text-base font-black text-white shadow-md transition hover:bg-red-700 focus:ring-4 focus:ring-red-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? 'Dispatching Warning...' : 'CONFIRM & ISSUE WARNING 🚨'}
          </button>

          <button
            type="button"
            onClick={onBackToEdit}
            className="w-full rounded-lg border-2 border-slate-300 bg-white py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-100 transition cursor-pointer"
          >
            ← Back to Edit
          </button>
        </div>
      </div>
    </div>
  );
}
