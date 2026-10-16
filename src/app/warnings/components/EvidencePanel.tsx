import React from 'react';
import type { EvidenceItem } from '../lib/types';
import { getDistrictName } from '../lib/helpers';

interface EvidencePanelProps {
  evidenceList: EvidenceItem[];
  loadingEvidence: boolean;
}

export function EvidencePanel({ evidenceList, loadingEvidence }: EvidencePanelProps) {
  return (
    <div className="lg:col-span-4 rounded-xl border-2 border-slate-200 bg-white p-5 shadow-sm space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <h3 className="text-base font-extrabold text-slate-900">Verified Evidence</h3>
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-900 border border-emerald-300">
          UC2 Feed
        </span>
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">
        <p className="font-bold text-slate-900">Operational Guideline</p>
        <p className="mt-1 leading-relaxed">
          Verified ground reports provide corroborating evidence. Official warnings must be
          explicitly issued by DMC Officials and are <strong>never auto-issued</strong>.
        </p>
      </div>

      {loadingEvidence ? (
        <div className="py-8 text-center text-xs font-medium text-slate-600">Loading ground evidence...</div>
      ) : evidenceList.length === 0 ? (
        <div className="py-8 text-center text-xs font-medium text-slate-600">
          No verified ground reports available for current scope.
        </div>
      ) : (
        <div className="space-y-3">
          {evidenceList.map((ev) => (
            <div
              key={ev.reportId}
              className="rounded-lg border-2 border-slate-200 bg-slate-50/70 p-3.5 text-xs space-y-1.5 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-950 text-sm">{ev.hazardType}</span>
                <span
                  className={`rounded px-2 py-0.5 font-extrabold ${
                    ev.severityIndication === 'HIGH'
                      ? 'bg-red-100 text-red-950 border border-red-300'
                      : 'bg-amber-100 text-amber-950 border border-amber-300'
                  }`}
                >
                  {ev.severityIndication ?? 'VERIFIED'}
                </span>
              </div>
              <p className="text-slate-800">
                District: <span className="font-bold text-slate-950">{getDistrictName(ev.districtId)}</span>
              </p>
              <p className="text-slate-700 font-mono">
                Coordinates: {ev.lat.toFixed(4)}, {ev.lng.toFixed(4)}
              </p>
              <div className="flex items-center justify-between pt-1.5 border-t border-slate-200 text-slate-700 font-medium">
                <span>Corroboration: <strong>{ev.corroborationCount}</strong> reports</span>
                <span>Confidence: <strong>{ev.confidence}</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
