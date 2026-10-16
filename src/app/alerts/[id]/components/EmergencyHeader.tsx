import React from 'react';

interface EmergencyHeaderProps {
  hazardType: string;
  severity: string;
  title?: string | null;
  occurredAt: string;
  isCancelled: boolean;
  cancellationReason?: string | null;
}

export function EmergencyHeader({
  hazardType,
  severity,
  title,
  occurredAt,
  isCancelled,
  cancellationReason,
}: EmergencyHeaderProps) {
  const severityHeaderColors: Record<string, string> = {
    EMERGENCY: 'bg-purple-900 text-white border-purple-950',
    WARNING: 'bg-red-700 text-white border-red-800',
    WATCH: 'bg-amber-600 text-white border-amber-700',
    ADVISORY: 'bg-yellow-500 text-slate-900 border-yellow-600',
  };

  return (
    <>
      <div className={`p-5 text-center ${severityHeaderColors[severity] ?? 'bg-slate-700 text-white'}`}>
        <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-3xl animate-pulse">
          🚨
        </div>
        <span className="text-xs font-extrabold tracking-widest uppercase opacity-90">
          EMERGENCY EARLY WARNING BULLETIN
        </span>
        <h1 className="mt-1 text-2xl font-black uppercase tracking-tight">
          {hazardType} {severity}
        </h1>
        {title && (
          <p className="mt-1.5 text-base font-extrabold tracking-wide text-white">
            {title}
          </p>
        )}
        <p className="mt-1 text-xs opacity-90">
          Issued: {new Date(occurredAt).toLocaleString()}
        </p>
      </div>

      {isCancelled && (
        <div className="border-b border-red-200 bg-red-100 p-3 text-center text-xs font-bold text-red-900">
          ⚠️ THIS HAZARD WARNING HAS BEEN CANCELLED
          {cancellationReason && (
            <p className="mt-1 text-xs font-medium">Reason: {cancellationReason}</p>
          )}
        </div>
      )}
    </>
  );
}
