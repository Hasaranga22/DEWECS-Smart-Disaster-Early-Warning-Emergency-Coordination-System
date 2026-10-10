"use client";

import dynamic from "next/dynamic";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import {
  RefreshCw, ShieldAlert, Megaphone, MapPin, Clock, CheckCircle2, XCircle, AlertTriangle,
  Hourglass, X, Crosshair, ImageOff, Check,
} from "lucide-react";
import {
  OfficerReport, HAZARD_META, HAZARD_KEYS, statusMeta, SEVERITY_META, hazardMeta, parsePhotos, timeAgo,
} from "@/modules/uc2-report/client/reportUi";

const DisasterMap = dynamic(() => import("@/modules/uc2-report/client/DisasterMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-slate-200 animate-pulse" />,
});

type StatusFilter = "ALL" | OfficerReport["reviewStatus"];
const REJECT_REASONS = ["Duplicate report", "Unclear photo or description", "Outside affected area", "Not a hazard"];
const noScrollbar = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/* ------------------------------------------------------------------ */
/* Small presentational components                                     */
/* ------------------------------------------------------------------ */

function StatCard({ label, value, icon, tone, active, onClick }: {
  label: string; value: number; icon: React.ReactNode; tone: string; active?: boolean; onClick?: () => void;
}) {
  const [clicking, setClicking] = useState(false);

  const handleClick = () => {
    if (onClick) {
      setClicking(true);
      // Faux preloader to make the UI feel responsive
      setTimeout(() => {
        setClicking(false);
        onClick();
      }, 300);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`text-left rounded-3xl p-4 sm:p-5 shadow-sm transition-all active:scale-[0.98] focus:outline-none ${
        active ? "bg-slate-100 ring-2 ring-slate-200" : "bg-white ring-0"
      }`}
    >
      <div className={`h-10 w-10 rounded-2xl flex items-center justify-center ${tone}`}>
        {clicking ? <RefreshCw className="animate-spin" size={20} /> : icon}
      </div>
      <p className="text-3xl font-bold text-slate-900 mt-3 tabular-nums">{value}</p>
      <p className="text-sm text-slate-500 mt-0.5">{label}</p>
    </button>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 px-3.5 py-2 rounded-full text-sm font-semibold shadow-md transition-colors ${
        active ? "bg-slate-900 text-white" : "bg-white text-slate-700 active:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

function ReportCard({ report, onVerify, onReject, onBroadcast, onFocus, onPhoto }: {
  report: OfficerReport;
  onVerify: () => void; onReject: () => void; onBroadcast: () => void; onFocus: () => void;
  onPhoto: (src: string) => void;
}) {
  const h = hazardMeta(report.hazardType);
  const photos = parsePhotos(report.photo);
  const status = statusMeta(report.reviewStatus);
  const isHighVerified = report.reviewStatus === "VERIFIED" && report.severityIndication === "HIGH";

  return (
    <article className="bg-white rounded-3xl shadow-sm flex flex-col overflow-hidden">
      <div className="p-5 flex-1">
        <div className="flex items-start gap-3">
          <div className={`h-12 w-12 rounded-2xl ${h.tint} flex items-center justify-center text-2xl shrink-0`}>{h.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-slate-900">{h.label}</h3>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${status.chip}`}>{status.label}</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
              <Clock size={12} /> {timeAgo(report.captureTime)}
            </p>
          </div>
        </div>

        <p className="text-sm text-slate-700 leading-relaxed mt-4 line-clamp-3">{report.description}</p>

        {/* Photos */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          {photos.length === 0 ? (
            <div className="col-span-3 h-16 rounded-2xl bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center gap-2 text-xs text-slate-400">
              <ImageOff size={16} /> No photos attached
            </div>
          ) : (
            photos.slice(0, 3).map((p, i) => (
              <button key={i} type="button" onClick={() => onPhoto(p)} className="aspect-square rounded-2xl overflow-hidden active:opacity-80" aria-label={`Open photo ${i + 1}`}>
                <img src={p} alt={`Evidence ${i + 1}`} className="h-full w-full object-cover" />
              </button>
            ))
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          {report.severityIndication && (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${SEVERITY_META[report.severityIndication].chip}`}>
              {SEVERITY_META[report.severityIndication].label} severity
            </span>
          )}
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
            {report.confidence === "FULL" ? "With photo" : "No photo"}
          </span>
          <button type="button" onClick={onFocus} className="ml-auto flex items-center gap-1 text-xs font-semibold text-teal-700 px-2.5 py-1 rounded-full bg-teal-50 active:bg-teal-100">
            <Crosshair size={13} /> Show on map
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-3 flex items-center gap-1 tabular-nums">
          <MapPin size={12} /> {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}
        </p>
      </div>

      {report.reviewStatus === "PENDING_REVIEW" && (
        <div className="p-3 bg-slate-50 grid grid-cols-2 gap-2.5">
          <button onClick={onReject} className="py-3 rounded-2xl bg-white text-red-600 font-semibold text-sm border border-red-200 active:bg-red-50">Reject</button>
          <button onClick={onVerify} className="py-3 rounded-2xl bg-emerald-600 text-white font-semibold text-sm active:bg-emerald-700">Verify</button>
        </div>
      )}
      {isHighVerified && (
        <div className="p-3 bg-red-50">
          <button onClick={onBroadcast} className="w-full py-3 rounded-2xl bg-red-600 text-white font-semibold text-sm flex items-center justify-center gap-2 active:bg-red-700">
            <Megaphone size={16} /> Send emergency alert
          </button>
        </div>
      )}
    </article>
  );
}

/** Centered dialog on desktop, bottom sheet on mobile. */
function Modal({ children, onClose, tone = "default" }: { children: React.ReactNode; onClose: () => void; tone?: "default" | "danger" }) {
  return (
    <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={`w-full sm:max-w-md bg-white rounded-t-[2rem] sm:rounded-3xl max-h-[92vh] overflow-y-auto shadow-2xl ${tone === "danger" ? "ring-2 ring-red-500" : ""}`}
      >
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function OfficerDashboard() {
  const [reports, setReports] = useState<OfficerReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const [filterStatus, setFilterStatus] = useState<StatusFilter>("PENDING_REVIEW");
  const [filterHazard, setFilterHazard] = useState("ALL");
  const [filterSeverity, setFilterSeverity] = useState("ALL");
  const [filterConfidence, setFilterConfidence] = useState("ALL");

  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<OfficerReport | null>(null);
  const [actionType, setActionType] = useState<"verify" | "reject" | null>(null);
  const [severity, setSeverity] = useState<keyof typeof SEVERITY_META>("MEDIUM");
  const [rejectReason, setRejectReason] = useState("");
  const [actionError, setActionError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const [alertTarget, setAlertTarget] = useState<OfficerReport | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  /* ---------- data ---------- */
  const fetchData = useCallback(async (initial = false) => {
    if (!initial) setRefreshing(true);
    try {
      const res = await fetch("/api/officer/reports");
      if (res.ok) {
        setReports(await res.json());
        setLastSync(new Date());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData(true);
    const id = setInterval(() => fetchData(), 15000);
    return () => clearInterval(id);
  }, [fetchData]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  /* ---------- derived ---------- */
  const counts = useMemo(() => {
    const c = { PENDING_REVIEW: 0, VERIFIED: 0, REJECTED: 0, HIGH: 0 };
    reports.forEach((r) => {
      c[r.reviewStatus]++;
      if (r.reviewStatus === "VERIFIED" && r.severityIndication === "HIGH") c.HIGH++;
    });
    return c;
  }, [reports]);

  const filtered = useMemo(
    () =>
      reports.filter(
        (r) =>
          (filterStatus === "ALL" || r.reviewStatus === filterStatus) &&
          (filterHazard === "ALL" || r.hazardType === filterHazard) &&
          (filterSeverity === "ALL" || (r.severityIndication || "NONE") === filterSeverity) &&
          (filterConfidence === "ALL" || r.confidence === filterConfidence),
      ),
    [reports, filterStatus, filterHazard, filterSeverity, filterConfidence],
  );

  const hazardStats = useMemo(() => {
    const m: Record<string, number> = {};
    reports.forEach((r) => (m[r.hazardType] = (m[r.hazardType] || 0) + 1));
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [reports]);

  const severityStats = useMemo(
    () =>
      (Object.keys(SEVERITY_META) as (keyof typeof SEVERITY_META)[]).map((k) => ({
        name: SEVERITY_META[k].label,
        value: reports.filter((r) => r.reviewStatus === "VERIFIED" && r.severityIndication === k).length,
        fill: SEVERITY_META[k].color,
      })),
    [reports],
  );

  const criticalThreats = useMemo(
    () => reports.filter((r) => r.reviewStatus === "VERIFIED" && r.severityIndication === "HIGH"),
    [reports],
  );

  const filtersActive = filterSeverity !== "ALL" || filterConfidence !== "ALL";

  /* ---------- actions ---------- */
  const openAction = (report: OfficerReport, type: "verify" | "reject") => {
    setSelected(report);
    setActionType(type);
    setActionError("");
    setRejectReason("");
    setSeverity("MEDIUM");
  };

  const closeAction = () => {
    setActionType(null);
    setSelected(null);
    setActionError("");
  };

  const handleActionSubmit = async () => {
    if (!selected || !actionType) return;
    setIsProcessing(true);
    setActionError("");
    try {
      const res = await fetch(`/api/officer/reports/${selected.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: actionType,
          expectedVersion: selected.version,
          officerId: "550e8400-e29b-41d4-a716-446655440002",
          severityIndication: actionType === "verify" ? severity : undefined,
          reason: actionType === "reject" ? rejectReason : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Couldn't save this review.");
      setToast(actionType === "verify" ? "Report verified" : "Report rejected");
      closeAction();
      await fetchData();
    } catch (err: any) {
      setActionError(err.message);
      if (err.message.includes("CONFLICT")) {
        setTimeout(() => { closeAction(); fetchData(); }, 4000);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmBroadcast = () => {
    if (!alertTarget) return;
    // In a real system this calls the UC1 Dispatch API.
    setToast(`Emergency alert sent for ${hazardMeta(alertTarget.hazardType).label.toLowerCase()} at ${alertTarget.latitude.toFixed(3)}, ${alertTarget.longitude.toFixed(3)}`);
    setAlertTarget(null);
  };

  const focusOnMap = (id: string) => {
    setFocusedId(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* ---------- render ---------- */
  const tabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: "PENDING_REVIEW", label: "Pending", count: counts.PENDING_REVIEW },
    { key: "VERIFIED", label: "Verified", count: counts.VERIFIED },
    { key: "REJECTED", label: "Rejected", count: counts.REJECTED },
    { key: "ALL", label: "All", count: reports.length },
  ];

  const selectCls = "bg-white border border-slate-200 text-slate-700 text-sm rounded-xl px-3 py-2.5 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500";

  return (
    <div className="min-h-screen bg-slate-100 pb-16">
      {/* Top bar */}
      <header className="bg-slate-950 text-white px-4 sm:px-8 pt-5 pb-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-2xl bg-teal-500/15 text-teal-300 flex items-center justify-center shrink-0">
              <ShieldAlert size={24} />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold truncate">Duty officer dashboard</h1>
              <p className="text-xs sm:text-sm text-slate-400 truncate">Review and verify citizen reports</p>
            </div>
          </div>
          <button
            onClick={() => fetchData()}
            disabled={refreshing}
            className="shrink-0 flex items-center gap-2 text-sm font-semibold bg-white/10 px-3.5 py-2.5 rounded-xl active:bg-white/20 disabled:opacity-70"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            <span className="hidden sm:inline">{refreshing ? "Refreshing…" : lastSync ? `Updated ${lastSync.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Refresh"}</span>
          </button>
        </div>

        {criticalThreats.length > 0 && (
          <div className="max-w-7xl mx-auto mt-4 bg-red-500/15 border border-red-500/40 text-red-100 rounded-2xl px-4 py-3 flex items-center gap-3">
            <Megaphone size={18} className="shrink-0 text-red-300" />
            <p className="text-sm font-semibold shrink-0">{criticalThreats.length} critical {criticalThreats.length === 1 ? "threat" : "threats"}</p>
            <div className={`flex gap-4 overflow-x-auto whitespace-nowrap text-sm ${noScrollbar}`}>
              {criticalThreats.map((t) => (
                <button key={t.id} onClick={() => focusOnMap(t.id)} className="underline underline-offset-2 decoration-red-300/50">
                  {hazardMeta(t.hazardType).label} · {t.latitude.toFixed(2)}, {t.longitude.toFixed(2)}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 space-y-6 mt-5">
        {/* MAP (hero) */}
        <section className="relative h-[60vh] min-h-[380px] max-h-[640px] rounded-3xl overflow-hidden shadow-sm bg-slate-200 isolate">
          <DisasterMap reports={filtered} focusedId={focusedId} onSelect={setFocusedId} />

          {/* Hazard filter chips */}
          <div className="absolute top-3 inset-x-3 z-[1000] pointer-events-none">
            <div className={`flex gap-2 overflow-x-auto pb-1 pointer-events-auto ${noScrollbar}`}>
              <Chip active={filterHazard === "ALL"} onClick={() => setFilterHazard("ALL")}>All hazards</Chip>
              {HAZARD_KEYS.map((k) => (
                <Chip key={k} active={filterHazard === k} onClick={() => setFilterHazard(k)}>
                  {HAZARD_META[k].icon} {HAZARD_META[k].label}
                </Chip>
              ))}
            </div>
          </div>

          {/* Result summary */}
          <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 backdrop-blur rounded-2xl shadow-lg px-4 py-3 pointer-events-none">
            <p className="text-sm font-semibold text-slate-900">{filtered.length} of {reports.length} reports on map</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
              {HAZARD_KEYS.map((k) => (
                <span key={k} className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: HAZARD_META[k].color }} /> {HAZARD_META[k].label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* KPIs */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard label="Waiting for review" value={counts.PENDING_REVIEW} icon={<Hourglass size={20} />} tone="bg-amber-50 text-amber-600" active={filterStatus === "PENDING_REVIEW"} onClick={() => setFilterStatus("PENDING_REVIEW")} />
          <StatCard label="Verified" value={counts.VERIFIED} icon={<CheckCircle2 size={20} />} tone="bg-emerald-50 text-emerald-600" active={filterStatus === "VERIFIED"} onClick={() => setFilterStatus("VERIFIED")} />
          <StatCard label="Rejected" value={counts.REJECTED} icon={<XCircle size={20} />} tone="bg-slate-100 text-slate-500" active={filterStatus === "REJECTED"} onClick={() => setFilterStatus("REJECTED")} />
          <StatCard label="High severity" value={counts.HIGH} icon={<AlertTriangle size={20} />} tone="bg-red-50 text-red-600" active={filterSeverity === "HIGH"} onClick={() => { setFilterStatus("VERIFIED"); setFilterSeverity("HIGH"); }} />
        </section>

        {/* Charts */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-3xl p-5 shadow-sm">
            <h2 className="font-bold text-slate-900">Reports by hazard</h2>
            <div className="flex items-center gap-4 mt-2">
              <div className="h-44 w-44 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={hazardStats} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={3} stroke="none">
                      {hazardStats.map((e) => <Cell key={e.name} fill={hazardMeta(e.name).color} />)}
                    </Pie>
                    <Tooltip formatter={(v: any, n: any) => [v, hazardMeta(String(n)).label]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="flex-1 space-y-2">
                {hazardStats.map((e) => (
                  <li key={e.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-slate-600">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: hazardMeta(e.name).color }} />
                      {hazardMeta(e.name).label}
                    </span>
                    <span className="font-semibold text-slate-900 tabular-nums">{e.value}</span>
                  </li>
                ))}
                {hazardStats.length === 0 && <li className="text-sm text-slate-400">No reports yet</li>}
              </ul>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-sm">
            <h2 className="font-bold text-slate-900">Verified by severity</h2>
            <div className="h-44 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={severityStats} margin={{ top: 10, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#64748b" }} />
                  <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fontSize: 12, fill: "#64748b" }} />
                  <Tooltip cursor={{ fill: "#f1f5f9" }} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={56}>
                    {severityStats.map((e) => <Cell key={e.name} fill={e.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Queue */}
        <section>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
            <h2 className="text-xl font-bold text-slate-900">Report queue</h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className={`flex bg-white rounded-2xl p-1 shadow-sm overflow-x-auto ${noScrollbar}`}>
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setFilterStatus(t.key)}
                    className={`px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors ${
                      filterStatus === t.key ? "bg-slate-900 text-white" : "text-slate-600 active:bg-slate-100"
                    }`}
                  >
                    {t.label} <span className={filterStatus === t.key ? "text-slate-300" : "text-slate-400"}>{t.count}</span>
                  </button>
                ))}
              </div>
              <select aria-label="Severity" value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)} className={selectCls}>
                <option value="ALL">Any severity</option>
                <option value="NONE">Not rated</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
              <select aria-label="Photo" value={filterConfidence} onChange={(e) => setFilterConfidence(e.target.value)} className={selectCls}>
                <option value="ALL">Any photo status</option>
                <option value="FULL">With photo</option>
                <option value="REDUCED">No photo</option>
              </select>
              {filtersActive && (
                <button onClick={() => { setFilterSeverity("ALL"); setFilterConfidence("ALL"); }} className="text-sm font-semibold text-teal-700 px-2 py-2">
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => <div key={i} className="h-72 bg-white rounded-3xl animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center shadow-sm">
              <div className="h-16 w-16 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto mb-4">
                <Check size={32} strokeWidth={3} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">No reports match</h3>
              <p className="text-sm text-slate-500 mt-1">Try another status or clear your filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((r) => (
                <ReportCard
                  key={r.id}
                  report={r}
                  onVerify={() => openAction(r, "verify")}
                  onReject={() => openAction(r, "reject")}
                  onBroadcast={() => setAlertTarget(r)}
                  onFocus={() => focusOnMap(r.id)}
                  onPhoto={setLightbox}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Review modal */}
      {actionType && selected && (
        <Modal onClose={closeAction}>
          <div className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-11 w-11 rounded-2xl flex items-center justify-center text-xl ${hazardMeta(selected.hazardType).tint}`}>{hazardMeta(selected.hazardType).icon}</div>
              <div>
                <h2 className="font-bold text-slate-900">{actionType === "verify" ? "Verify report" : "Reject report"}</h2>
                <p className="text-xs text-slate-500">{hazardMeta(selected.hazardType).label} · {timeAgo(selected.captureTime)}</p>
              </div>
            </div>
            <button onClick={closeAction} aria-label="Close" className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600"><X size={18} /></button>
          </div>

          <div className="px-5 pb-2">
            <p className="text-sm text-slate-600 bg-slate-50 rounded-2xl p-3.5 line-clamp-3">{selected.description}</p>

            {actionError && (
              <div role="alert" className="mt-4 p-3.5 bg-red-50 text-red-700 rounded-2xl text-sm font-medium flex gap-2.5">
                <AlertTriangle size={18} className="shrink-0 mt-0.5" /> {actionError}
              </div>
            )}

            {actionType === "verify" ? (
              <div className="mt-5">
                <p className="text-sm font-semibold text-slate-900 mb-2.5">How severe is it?</p>
                <div className="grid grid-cols-3 gap-2.5">
                  {(Object.keys(SEVERITY_META) as (keyof typeof SEVERITY_META)[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setSeverity(k)}
                      aria-pressed={severity === k}
                      className={`py-3.5 rounded-2xl border-2 text-sm font-semibold transition-colors ${
                        severity === k ? SEVERITY_META[k].pick : "border-transparent bg-slate-100 text-slate-600"
                      }`}
                    >
                      {SEVERITY_META[k].label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-5">
                <p className="text-sm font-semibold text-slate-900 mb-2.5">Why are you rejecting it?</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {REJECT_REASONS.map((r) => (
                    <button key={r} type="button" onClick={() => setRejectReason(r)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold ${rejectReason === r ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>
                      {r}
                    </button>
                  ))}
                </div>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="Add a reason the reporter will understand"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                />
              </div>
            )}
          </div>

          <div className="p-5 grid grid-cols-2 gap-3">
            <button onClick={closeAction} disabled={isProcessing} className="py-3.5 rounded-2xl bg-slate-100 text-slate-700 font-semibold disabled:opacity-50">Cancel</button>
            <button
              onClick={handleActionSubmit}
              disabled={isProcessing || (actionType === "reject" && !rejectReason.trim())}
              className={`py-3.5 rounded-2xl text-white font-semibold disabled:opacity-40 ${actionType === "verify" ? "bg-emerald-600" : "bg-red-600"}`}
            >
              {isProcessing ? "Saving…" : actionType === "verify" ? "Verify report" : "Reject report"}
            </button>
          </div>
        </Modal>
      )}

      {/* Emergency alert modal */}
      {alertTarget && (
        <Modal onClose={() => setAlertTarget(null)} tone="danger">
          <div className="p-7 text-center">
            <div className="h-16 w-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <Megaphone size={30} />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Send emergency alert?</h2>
            <p className="text-sm text-slate-600 leading-relaxed mt-2">
              This sends the verified <strong>{hazardMeta(alertTarget.hazardType).label.toLowerCase()}</strong> report to the UC1 Dispatch System. SMS alerts and local sirens in Colombo start right away.
            </p>
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button onClick={() => setAlertTarget(null)} className="py-3.5 rounded-2xl bg-slate-100 text-slate-700 font-semibold">Cancel</button>
              <button onClick={confirmBroadcast} className="py-3.5 rounded-2xl bg-red-600 text-white font-semibold shadow-lg shadow-red-600/30">Send alert</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Photo lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[2100] bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button aria-label="Close photo" className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/15 text-white flex items-center justify-center"><X size={20} /></button>
          <img src={lightbox} alt="Evidence" className="max-h-full max-w-full rounded-2xl object-contain" />
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div role="status" className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[2200] max-w-[90vw] bg-slate-900 text-white text-sm font-medium px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2">
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" /> {toast}
        </div>
      )}
    </div>
  );
}