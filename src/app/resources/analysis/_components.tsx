"use client";

import type { ReactNode } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, Loader2 } from "lucide-react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-slate-900 rounded-xl border border-slate-800 p-4 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-sm font-bold text-white mb-3">{children}</h2>;
}

export function KpiTile({
  label,
  value,
  subtext,
  icon,
  progress,
  progressColor = "bg-blue-500",
}: {
  label: string;
  value: string | number;
  subtext?: ReactNode;
  icon?: ReactNode;
  progress?: number;
  progressColor?: string;
}) {
  return (
    <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between text-slate-400 text-xs mb-2 font-medium">
          <span>{label}</span>
          {icon}
        </div>
        <div className="text-3xl font-bold text-white tabular-nums tracking-tight mb-1">{value}</div>
        {subtext && <div className="text-[11px] text-slate-400 leading-normal">{subtext}</div>}
      </div>
      {typeof progress === "number" && (
        <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800 mt-3">
          <div
            className={`h-full ${progressColor} transition-all duration-300`}
            style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function StatusBadge({
  status,
  text,
}: {
  status: "OPEN" | "FULL" | "ACTIVE" | "PENDING" | "FINAL" | "SENT" | "FAILED" | string;
  text?: string;
}) {
  const map: Record<string, string> = {
    OPEN: "bg-emerald-950 text-emerald-400 border-emerald-800",
    SENT: "bg-emerald-950 text-emerald-400 border-emerald-800",
    FINAL: "bg-blue-950 text-blue-400 border-blue-800",
    FULL: "bg-red-950 text-red-400 border-red-800",
    FAILED: "bg-red-950 text-red-400 border-red-800",
    ACTIVE: "bg-blue-950 text-blue-400 border-blue-800",
    PENDING: "bg-amber-950 text-amber-400 border-amber-800",
  };
  const style = map[status] || "bg-slate-800 text-slate-300 border-slate-700";

  return (
    <span
      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border tracking-wide inline-flex items-center gap-1 ${style}`}
    >
      {text || status}
    </span>
  );
}

export function Banner({
  type,
  children,
  onClose,
}: {
  type: "success" | "error" | "warn" | "info";
  children: ReactNode;
  onClose?: () => void;
}) {
  const map = {
    success: { bg: "bg-emerald-950/80", border: "border-emerald-800", text: "text-emerald-200", Icon: CheckCircle2 },
    error: { bg: "bg-red-950/80", border: "border-red-800", text: "text-red-200", Icon: XCircle },
    warn: { bg: "bg-amber-950/80", border: "border-amber-800", text: "text-amber-200", Icon: AlertTriangle },
    info: { bg: "bg-blue-950/80", border: "border-blue-800", text: "text-blue-200", Icon: Info },
  }[type];

  const Icon = map.Icon;

  return (
    <div
      className={`${map.bg} border ${map.border} p-4 rounded-xl flex items-center justify-between text-xs ${map.text}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <Icon className="w-4 h-4 shrink-0" />
        <div>{children}</div>
      </div>
      {onClose && (
        <button onClick={onClose} className="opacity-60 hover:opacity-100" aria-label="Dismiss banner">
          <XCircle className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export function Loading({ message = "Loading" }: { message?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-xs text-slate-400">
      <Loader2 className="w-4 h-4 text-blue-400 animate-spin" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="text-center py-12 bg-slate-900 rounded-xl border border-slate-800 p-6">
      <h3 className="text-sm font-bold text-white mb-2">{title}</h3>
      <p className="text-xs text-slate-400 mb-4">{message}</p>
      {action}
    </div>
  );
}
