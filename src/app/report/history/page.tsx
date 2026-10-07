"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, ChevronLeft, ClipboardList, Clock, MapPin, RefreshCw } from "lucide-react";
import { DEMO_CITIZEN_ID } from "@/modules/uc2-report/client/citizen";
import { hazardMeta, timeAgo } from "@/modules/uc2-report/client/reportUi";

type CitizenReport = {
  id: string;
  hazardType: string;
  description: string;
  captureTime: string;
  reviewStatus: "PENDING_REVIEW" | "NEEDS_INFO" | "VERIFIED" | "REJECTED";
  severityIndication?: "LOW" | "MEDIUM" | "HIGH";
  latitude: number;
  longitude: number;
};

const STATUS = {
  PENDING_REVIEW: { label: "Sent · awaiting review", classes: "bg-amber-50 text-amber-700", icon: Clock },
  NEEDS_INFO: { label: "More information needed", classes: "bg-sky-50 text-sky-700", icon: AlertCircle },
  VERIFIED: { label: "Verified", classes: "bg-emerald-50 text-emerald-700", icon: CheckCircle2 },
  REJECTED: { label: "Not accepted", classes: "bg-red-50 text-red-700", icon: AlertCircle },
} as const;

export default function ReportHistoryPage() {
  const [reports, setReports] = useState<CitizenReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/reports/mine?reporterId=${encodeURIComponent(DEMO_CITIZEN_ID)}`);
      if (!response.ok) throw new Error("Could not load your reports.");
      setReports(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadReports(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadReports]);

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <header className="bg-slate-950 text-white px-5 pt-5 pb-16 rounded-b-[2rem]">
        <div className="flex items-center justify-between">
          <Link href="/report/outbox" aria-label="Back to outbox" className="h-10 w-10 -ml-2 flex items-center justify-center rounded-full active:bg-white/10">
            <ChevronLeft size={24} />
          </Link>
          <button onClick={() => void loadReports()} disabled={loading} className="flex items-center gap-1.5 text-sm font-semibold text-slate-200 px-3 py-2 rounded-xl active:bg-white/10 disabled:opacity-50">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
        <h1 className="text-2xl font-bold mt-3">Sent reports</h1>
        <p className="text-sm text-slate-400 mt-1">Track reports that have reached emergency coordinators.</p>
      </header>

      <main className="px-4 -mt-9 max-w-md mx-auto">
        {loading ? (
          <div className="bg-white rounded-3xl p-10 text-center text-slate-500"><RefreshCw className="animate-spin mx-auto mb-3" /> Loading your reports…</div>
        ) : error ? (
          <div role="alert" className="bg-white rounded-3xl p-8 text-center shadow-sm">
            <AlertCircle className="mx-auto text-red-500 mb-3" size={32} />
            <p className="font-semibold text-slate-900">Couldn&apos;t load reports</p>
            <p className="text-sm text-slate-500 mt-1">{error}</p>
            <button onClick={() => void loadReports()} className="mt-5 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold">Try again</button>
          </div>
        ) : reports.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 flex flex-col items-center text-center shadow-sm">
            <div className="h-20 w-20 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center mb-4"><ClipboardList size={36} /></div>
            <p className="font-bold text-slate-900 text-lg">No sent reports yet</p>
            <p className="text-slate-500 text-sm mt-1 max-w-[16rem]">Reports appear here after they have been delivered.</p>
            <Link href="/report/new" className="mt-6 px-6 py-3 rounded-2xl bg-slate-900 text-white text-sm font-semibold">Report a hazard</Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {reports.map((report) => {
              const hazard = hazardMeta(report.hazardType);
              const status = STATUS[report.reviewStatus];
              const StatusIcon = status.icon;
              return (
                <li key={report.id} className="bg-white p-4 rounded-3xl shadow-sm">
                  <div className="flex gap-3.5">
                    <div className={`h-14 w-14 rounded-2xl ${hazard.tint} flex items-center justify-center text-3xl shrink-0`}>{hazard.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="font-semibold text-slate-900">{hazard.label}</h2>
                        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0 ${status.classes}`}><StatusIcon size={12} /> {status.label}</span>
                      </div>
                      <p className="text-sm text-slate-600 mt-1 line-clamp-2">{report.description}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-slate-400">
                        <span>{timeAgo(report.captureTime)}</span>
                        <span className="flex items-center gap-1"><MapPin size={12} /> {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}</span>
                        {report.severityIndication && <span className="font-medium text-slate-500">{report.severityIndication.toLowerCase()} severity</span>}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
