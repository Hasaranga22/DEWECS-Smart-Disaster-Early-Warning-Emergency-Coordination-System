import React from 'react';
import Link from 'next/link';
import type { AlertItem } from '../lib/types';
import { getTargetDisplayName } from '../lib/helpers';
import { SeverityBadge, StatusBadge } from './ui';

interface AlertCardProps {
  alert: AlertItem;
  isDmcOfficial: boolean;
  onEscalate: (alert: AlertItem) => void;
  onCancel: (alert: AlertItem) => void;
}

export function AlertCard({
  alert,
  isDmcOfficial,
  onEscalate,
  onCancel,
}: AlertCardProps) {
  const isEmergency = alert.severity === 'EMERGENCY';
  const isClosed = alert.status === 'CANCELLED' || alert.status === 'EXPIRED';

  return (
    <div className="rounded-xl border-2 border-slate-200 p-5 transition hover:border-slate-300 bg-white shadow-sm flex flex-col justify-between space-y-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-black text-slate-950 text-base">{alert.hazardType}</span>
            <SeverityBadge severity={alert.severity} />
            <StatusBadge status={alert.status} />
          </div>
        </div>

        {alert.title && (
          <h3 className="text-base font-extrabold text-slate-950 -mt-1">
            {alert.title}
          </h3>
        )}

        <p className="text-sm font-medium text-slate-900 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
          {alert.message}
        </p>

        <div className="space-y-1.5 text-xs text-slate-700">
          <div>
            <span className="font-semibold text-slate-600">Target Area: </span>
            <span className="font-bold text-slate-950">
              {getTargetDisplayName(alert.target)}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-600 font-medium pt-1 border-t border-slate-100">
            <span>Occurred: {new Date(alert.occurredAt).toLocaleString()}</span>
            {alert.expiresAt && (
              <span>Expires: {new Date(alert.expiresAt).toLocaleString()}</span>
            )}
          </div>
        </div>

        {(alert.status === 'CANCELLED' || alert.cancellationReason) && (
          <div className="rounded-md border border-slate-200 bg-slate-100 p-2.5 text-xs text-slate-800">
            <span className="font-bold text-slate-950">
              Cancelled {alert.cancelledAt ? new Date(alert.cancelledAt).toLocaleString() : ''}:
            </span>{' '}
            {alert.cancellationReason || 'No reason specified'}
          </div>
        )}

        {alert.escalations && alert.escalations.length > 0 && (
          <div className="rounded-md border border-blue-200 bg-blue-50 p-2.5 text-xs text-blue-950 space-y-1">
            <span className="font-extrabold text-blue-950">Escalation History:</span>
            {alert.escalations.map((esc) => (
              <div key={esc.id} className="pl-2 border-l-2 border-blue-400 font-medium">
                <strong>{esc.fromSeverity} → {esc.toSeverity}</strong> ({new Date(esc.occurredAt).toLocaleTimeString()})
                {esc.reason ? ` – ${esc.reason}` : ''}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Operational Action Buttons (DMC Official) */}
      <div className="pt-3 border-t border-slate-200 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href={`/alerts/${alert.id}`}
            className="text-xs font-bold text-blue-700 hover:underline"
          >
            Citizen Receipt View →
          </Link>

          {isDmcOfficial && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isEmergency || isClosed}
                title={
                  isClosed
                    ? 'Alert is closed and cannot be escalated'
                    : isEmergency
                    ? 'Alert is already at maximum severity (EMERGENCY)'
                    : 'Escalate severity'
                }
                onClick={() => onEscalate(alert)}
                className="rounded-md border-2 border-purple-400 bg-purple-50 px-2.5 py-1 text-xs font-extrabold text-purple-950 transition hover:bg-purple-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Escalate
              </button>

              <button
                type="button"
                disabled={isClosed}
                title={isClosed ? 'Alert is already closed' : 'Cancel alert'}
                onClick={() => onCancel(alert)}
                className="rounded-md border-2 border-red-400 bg-red-50 px-2.5 py-1 text-xs font-extrabold text-red-950 transition hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {isDmcOfficial && (isClosed || isEmergency) && (
          <div className="flex items-start gap-1.5 text-[11px] text-slate-700 font-medium">
            <span className="shrink-0 text-slate-500 font-bold">ℹ️</span>
            <span>
              {isClosed
                ? 'Alert is closed. Escalate and cancel are unavailable.'
                : 'Already at maximum severity (Emergency). It cannot be escalated.'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
