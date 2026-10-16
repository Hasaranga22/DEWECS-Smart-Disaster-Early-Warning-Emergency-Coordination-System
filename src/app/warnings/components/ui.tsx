import React from 'react';

export function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    EMERGENCY: 'bg-purple-100 text-purple-950 border border-purple-300',
    WARNING: 'bg-red-100 text-red-950 border border-red-300',
    WATCH: 'bg-orange-100 text-orange-950 border border-orange-300',
    ADVISORY: 'bg-yellow-100 text-yellow-950 border border-yellow-300',
  };

  return (
    <span className={`rounded px-2.5 py-0.5 text-xs font-extrabold ${styles[severity] ?? 'bg-slate-100 text-slate-800 border border-slate-300'}`}>
      {severity}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: 'bg-emerald-100 text-emerald-950 border border-emerald-300',
    ESCALATED: 'bg-blue-100 text-blue-950 border border-blue-300',
    CANCELLED: 'bg-slate-200 text-slate-900 border border-slate-300',
    EXPIRED: 'bg-zinc-200 text-zinc-900 border border-zinc-300',
  };

  return (
    <span className={`rounded px-2.5 py-0.5 text-xs font-extrabold ${styles[status] ?? 'bg-slate-200 text-slate-900 border border-slate-300'}`}>
      {status}
    </span>
  );
}

export function StatCard({
  title,
  value,
  subtext,
  valueColor = 'text-slate-900',
}: {
  title: string;
  value: number | string;
  subtext?: string;
  valueColor?: string;
}) {
  return (
    <div className="rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm flex flex-col justify-between">
      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{title}</span>
      <div className="mt-2 flex items-baseline justify-between">
        <span className={`text-2xl font-black ${valueColor}`}>{value}</span>
        {subtext && <span className="text-[11px] font-semibold text-slate-500">{subtext}</span>}
      </div>
    </div>
  );
}
