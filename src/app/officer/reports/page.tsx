"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity, AlertCircle, AlertTriangle, ArrowUpRight, Check, CheckCircle2,
  ChevronDown, Clock3, ImageOff, ListFilter, MapPin,
  Megaphone, RefreshCw, Search, ShieldCheck, SlidersHorizontal, X, XCircle,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  HAZARD_KEYS, HAZARD_META, SEVERITY_META, hazardMeta,
  parsePhotos, statusMeta, timeAgo,
} from "@/modules/uc2-report/client/reportUi";
import type { OfficerReport } from "@/modules/uc2-report/client/reportUi";

const DisasterMap = dynamic(() => import("@/modules/uc2-report/client/DisasterMap"), {
  ssr: false,
  loading: () => <div className="h-full animate-pulse bg-slate-100" />,
});

type Status = "ALL" | OfficerReport["reviewStatus"];
type ReviewAction = "verify" | "reject";
type Severity = keyof typeof SEVERITY_META;
type ReviewDialog = { report: OfficerReport; action: ReviewAction } | null;
type PhotoDialog = { src: string; report: OfficerReport } | null;

const REJECTION_REASONS = [
  "Duplicate report", "Unclear photo or description",
  "Outside affected area", "Not a hazard",
];
// The map is an operational view, not an archive. Verified incident markers
// expire seven days after the reported incident time.
const MAP_INCIDENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const isActiveMapIncident = (report: OfficerReport, now: number) => {
  const legacyExpiry = new Date(report.captureTime).getTime() + MAP_INCIDENT_WINDOW_MS;
  const persistedExpiry = report.mapVisibleUntil ? new Date(report.mapVisibleUntil).getTime() : legacyExpiry;
  return report.reviewStatus === "VERIFIED"
    && report.mapStatus !== "RESOLVED"
    && Number.isFinite(persistedExpiry)
    && persistedExpiry > now;
};

const expiryLabel = (report: OfficerReport, now: number) => {
  const legacyExpiry = new Date(report.captureTime).getTime() + MAP_INCIDENT_WINDOW_MS;
  const expiry = report.mapVisibleUntil ? new Date(report.mapVisibleUntil).getTime() : legacyExpiry;
  const remainingMs = expiry - now;
  if (remainingMs <= 0) return "Expired — extend to restore";
  const remainingHours = Math.max(0, Math.ceil(remainingMs / (60 * 60 * 1000)));
  if (remainingHours <= 24) return "Expires today";
  const days = Math.ceil(remainingHours / 24);
  return `Expires in ${days} days`;
};

const KNOWN_LOCATIONS = [
  { name: "Kelaniya", latitude: 6.956, longitude: 79.922 },
  { name: "Colombo", latitude: 6.927, longitude: 79.861 },
  { name: "Gampaha", latitude: 7.087, longitude: 80.014 },
  { name: "Kandy", latitude: 7.291, longitude: 80.634 },
  { name: "Galle", latitude: 6.033, longitude: 80.217 },
  { name: "Ratnapura", latitude: 6.682, longitude: 80.402 },
  { name: "Kurunegala", latitude: 7.486, longitude: 80.364 },
  { name: "Jaffna", latitude: 9.662, longitude: 80.025 },
] as const;

const nearestLocationLabel = (latitude: number, longitude: number) => {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const distanceKm = (place: typeof KNOWN_LOCATIONS[number]) => {
    const latitudeDelta = toRadians(place.latitude - latitude);
    const longitudeDelta = toRadians(place.longitude - longitude);
    const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(toRadians(latitude)) * Math.cos(toRadians(place.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };
  const nearest = KNOWN_LOCATIONS.reduce((best, place) => distanceKm(place) < distanceKm(best) ? place : best);
  return `Near ${nearest.name} · ${distanceKm(nearest).toFixed(1)} km`;
};

const incidentDateLabel = (iso: string) => new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
}).format(new Date(iso));
const PANEL = "rounded-[20px] border border-slate-200/80 bg-white shadow-[0_3px_18px_rgba(15,23,42,0.035)]";
const CONTROL = "rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";
const BUTTON_FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2";
const HIDDEN_SCROLLBAR = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

function Metric({ label, count, icon, color, selected, onClick, description }: {
  label: string;
  count: number;
  icon: ReactNode;
  color: string;
  selected: boolean;
  onClick: () => void;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`${PANEL} ${BUTTON_FOCUS} group flex min-w-0 flex-col gap-3 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md sm:p-5 ${selected ? "border-indigo-300 ring-1 ring-indigo-100" : ""}`}
    >
      <div className="flex w-full items-start justify-between gap-2">
        <span className={`grid size-10 place-items-center rounded-xl ${color}`}>{icon}</span>
        <ArrowUpRight size={15} className="text-slate-300 transition group-hover:text-indigo-500" />
      </div>
      <div>
        <p className="text-2xl font-semibold tracking-tight text-slate-950 tabular-nums sm:text-[28px]">{count.toLocaleString()}</p>
        <p className="mt-0.5 text-sm font-semibold text-slate-700">{label}</p>
        <p className="mt-1 text-xs text-slate-400">{description}</p>
      </div>
    </button>
  );
}

function SectionTitle({ eyebrow, title, detail, action }: {
  eyebrow?: string;
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        {eyebrow && <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-500">{eyebrow}</p>}
        <h2 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">{title}</h2>
        {detail && <p className="mt-0.5 text-xs text-slate-500">{detail}</p>}
      </div>
      {action}
    </div>
  );
}

function Modal({ title, description, children, onClose, busy = false }: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  // Keep destructive confirmation visible until the request finishes.
  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-[3px] sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label={title} className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[24px] bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-[24px] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-950">{title}</h2>
            {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
          </div>
          <button type="button" aria-label="Close dialog" disabled={busy} onClick={onClose} className={`${BUTTON_FOCUS} rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40`}><X size={18} /></button>
        </div>
        <div className="mt-5">{children}</div>
      </section>
    </div>
  );
}

function ReportCard({ report, mapVisible, onReview, onBroadcast, onFocus, onPhoto }: {
  report: OfficerReport;
  mapVisible: boolean;
  onReview: (action: ReviewAction) => void;
  onBroadcast: () => void;
  onFocus: () => void;
  onPhoto: (src: string) => void;
}) {
  const hazard = hazardMeta(report.hazardType);
  const status = statusMeta(report.reviewStatus);
  const photos = parsePhotos(report.photo);
  const [expanded, setExpanded] = useState(false);
  const canAlert = report.reviewStatus === "VERIFIED" && report.severityIndication === "HIGH";

  return (
    <article className={`${PANEL} flex h-full flex-col overflow-hidden transition hover:shadow-md`}>
      <div className="flex-1 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`grid size-11 shrink-0 place-items-center rounded-xl text-xl ${hazard.tint}`} aria-hidden="true">{hazard.icon}</div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-slate-900">{hazard.label}</h3>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400"><Clock3 size={12} /> {timeAgo(report.captureTime)}</p>
            </div>
          </div>
          <span className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${status.chip}`}>{status.label}</span>
        </div>
        <p className={`mt-4 text-sm leading-6 text-slate-600 ${expanded ? "" : "line-clamp-3"}`}>{report.description}</p>
        {report.description.length > 125 && (
          <button type="button" onClick={() => setExpanded((value) => !value)} className={`${BUTTON_FOCUS} mt-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800`}>
            {expanded ? "Show less" : "Read full report"}
          </button>
        )}
        <div className="mt-4 flex gap-2">
          {photos.length ? photos.slice(0, 3).map((src, index) => (
            <button key={`${src}-${index}`} type="button" onClick={() => onPhoto(src)} aria-label={`Open evidence photo ${index + 1}`} className={`${BUTTON_FOCUS} size-[68px] overflow-hidden rounded-xl bg-slate-100`}>
              {/* Evidence URLs originate from report data; keep the original URL intact. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Evidence photo ${index + 1}`} className="size-full object-cover transition hover:scale-105" />
            </button>
          )) : (
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-400"><ImageOff size={14} /> No evidence photos</div>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {report.severityIndication && <span className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${SEVERITY_META[report.severityIndication].chip}`}>{SEVERITY_META[report.severityIndication].label} severity</span>}
          <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500">{photos.length ? `${photos.length} photo${photos.length === 1 ? "" : "s"}` : "No photo"}</span>
        </div>
        {mapVisible && (
          <button type="button" onClick={onFocus} className={`${BUTTON_FOCUS} mt-4 flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800`}><MapPin size={13} /> Locate on map <ArrowUpRight size={12} /></button>
        )}
        <p className="mt-2 text-[11px] text-slate-400 tabular-nums">{report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}</p>
      </div>
      {report.reviewStatus === "PENDING_REVIEW" && (
        <div className="grid grid-cols-2 gap-2 border-t border-slate-100 bg-slate-50/70 p-3">
          <button type="button" onClick={() => onReview("reject")} className={`${BUTTON_FOCUS} rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 transition hover:border-rose-200 hover:text-rose-600`}>Reject</button>
          <button type="button" onClick={() => onReview("verify")} className={`${BUTTON_FOCUS} flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700`}><Check size={15} /> Verify</button>
        </div>
      )}
      {canAlert && (
        <div className="border-t border-rose-100 bg-rose-50/60 p-3">
          <button type="button" onClick={onBroadcast} className={`${BUTTON_FOCUS} flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-700`}><Megaphone size={15} /> Emergency dispatch</button>
        </div>
      )}
    </article>
  );
}

export default function OfficerDashboard() {
  const [reports, setReports] = useState<OfficerReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [activeRoleName, setActiveRoleName] = useState("DMC Officer");
  const [status, setStatus] = useState<Status>("PENDING_REVIEW");

  useEffect(() => {
    if (typeof document !== "undefined") {
      const match = document.cookie.match(/(?:^|;\s*)dewecs_role=([^;]+)/);
      if (match) {
        const val = decodeURIComponent(match[1]);
        if (val === "DUTY_OFFICER") setActiveRoleName("Duty Officer");
        else if (val === "DISTRICT_OFFICER") setActiveRoleName("District Officer");
        else if (val === "CITIZEN") setActiveRoleName("Citizen");
        else setActiveRoleName("DMC Officer");
      }
    }
  }, []);
  const [hazard, setHazard] = useState("ALL");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [photoFilter, setPhotoFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showIncidentControls, setShowIncidentControls] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewDialog>(null);
  const [reviewSeverity, setReviewSeverity] = useState<Severity>("MEDIUM");
  const [rejectReason, setRejectReason] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resolvingIncidentId, setResolvingIncidentId] = useState<string | null>(null);
  const [dispatchTarget, setDispatchTarget] = useState<OfficerReport | null>(null);
  const [photo, setPhoto] = useState<PhotoDialog>(null);
  const [notice, setNotice] = useState("");
  const mapNow = lastSync?.getTime() ?? 0;

  const fetchReports = useCallback(async (initial = false) => {
    if (!initial) setRefreshing(true);
    try {
      const response = await fetch("/api/officer/reports", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load reports. Please try again.");
      const data: OfficerReport[] = await response.json();
      setReports(data);
      setLastSync(new Date());
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load reports.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchReports(true);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void fetchReports();
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [fetchReports]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  // One pass computes the overview; all views share the same report source.
  const counts = useMemo(() => reports.reduce((result, report) => {
    result[report.reviewStatus] += 1;
    if (report.reviewStatus === "VERIFIED" && report.severityIndication === "HIGH") result.HIGH += 1;
    return result;
  }, { PENDING_REVIEW: 0, VERIFIED: 0, REJECTED: 0, HIGH: 0 }), [reports]);

  const filtered = useMemo(() => reports.filter((report) => {
    const query = search.trim().toLowerCase();
    return (status === "ALL" || report.reviewStatus === status)
      && (hazard === "ALL" || report.hazardType === hazard)
      && (severityFilter === "ALL" || (report.severityIndication ?? "NONE") === severityFilter)
      && (photoFilter === "ALL" || report.confidence === photoFilter)
      && (!query || `${report.description} ${hazardMeta(report.hazardType).label} ${report.id}`.toLowerCase().includes(query));
  }), [reports, status, hazard, severityFilter, photoFilter, search]);

  // Pending, rejected, and expired reports remain in the review history but
  // never become live map markers.
  const mappedReports = useMemo(() => {
    return reports.filter((report) => (
      isActiveMapIncident(report, mapNow)
        && (hazard === "ALL" || report.hazardType === hazard)
    ));
  }, [reports, hazard, mapNow]);
  const mappedReportIds = useMemo(() => new Set(mappedReports.map((report) => report.id)), [mappedReports]);
  const activeIncidents = useMemo(() => {
    return reports.filter((report) => isActiveMapIncident(report, mapNow));
  }, [reports, mapNow]);
  const managedIncidents = useMemo(() => reports.filter((report) => (
    report.reviewStatus === "VERIFIED" && report.mapStatus !== "RESOLVED"
  )), [reports]);

  const hazardStats = useMemo(() => HAZARD_KEYS.map((key) => ({
    key, label: HAZARD_META[key].label,
    value: reports.filter((report) => report.hazardType === key).length,
    color: HAZARD_META[key].color,
  })).filter((item) => item.value > 0), [reports]);

  const severityStats = useMemo(() => (Object.keys(SEVERITY_META) as Severity[]).map((key) => ({
    name: SEVERITY_META[key].label,
    value: reports.filter((report) => report.reviewStatus === "VERIFIED" && report.severityIndication === key).length,
    color: SEVERITY_META[key].color,
  })), [reports]);

  const criticalReports = useMemo(() => reports.filter((report) => report.reviewStatus === "VERIFIED" && report.severityIndication === "HIGH"), [reports]);
  const filtersActive = hazard !== "ALL" || severityFilter !== "ALL" || photoFilter !== "ALL" || search.trim() !== "";

  const clearFilters = () => {
    setHazard("ALL");
    setSeverityFilter("ALL");
    setPhotoFilter("ALL");
    setSearch("");
    setStatus("ALL");
  };

  const focusOnMap = (id: string) => {
    setFocusedId(id);
    document.getElementById("incident-map")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const openReview = (report: OfficerReport, action: ReviewAction) => {
    setReview({ report, action });
    setReviewSeverity("MEDIUM");
    setRejectReason("");
    setActionError("");
  };

  const submitReview = async () => {
    if (!review || busy) return;
    const { report, action } = review;
    if (action === "reject" && !rejectReason.trim()) return;
    setBusy(true);
    setActionError("");
    try {
      const response = await fetch(`/api/officer/reports/${report.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          expectedVersion: report.version,
          // Preserve the existing API contract. Replace this with an authenticated officer ID server-side.
          officerId: "550e8400-e29b-41d4-a716-446655440002",
          severityIndication: action === "verify" ? reviewSeverity : undefined,
          reason: action === "reject" ? rejectReason.trim() : undefined,
        }),
      });
      const data: { message?: string } = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to save review.");
      setReview(null);
      setNotice(action === "verify" ? "Report verified successfully" : "Report rejected successfully");
      await fetchReports();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to save review.");
    } finally {
      setBusy(false);
    }
  };

  const updateIncidentLifecycle = async (report: OfficerReport, action: "resolve" | "extend") => {
    if (resolvingIncidentId) return;
    setResolvingIncidentId(report.id);
    try {
      const response = await fetch(`/api/officer/reports/${report.id}/incident-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          expectedVersion: report.version,
          officerId: "550e8400-e29b-41d4-a716-446655440002",
        }),
      });
      const data: { message?: string } = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to update this incident.");
      setNotice(action === "resolve" ? "Incident resolved and removed from the live map" : "Map visibility extended by 7 days");
      await fetchReports();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to update this incident.");
    } finally {
      setResolvingIncidentId(null);
    }
  };

  const tabs: { key: Status; label: string; count: number }[] = [
    { key: "PENDING_REVIEW", label: "Pending", count: counts.PENDING_REVIEW },
    { key: "VERIFIED", label: "Verified", count: counts.VERIFIED },
    { key: "REJECTED", label: "Rejected", count: counts.REJECTED },
    { key: "ALL", label: "All reports", count: reports.length },
  ];

  return (
    <div className="min-h-screen bg-[#f7f8fc] pb-16 text-slate-900">
      <div className="h-1 w-full bg-gradient-to-r from-violet-500 via-indigo-600 to-blue-500" />
      <header className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-7 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-[14px] bg-indigo-600 text-white shadow-md shadow-indigo-200">
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-600">DEWECS / Operations</p>
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                  <span className="size-1.5 rounded-full bg-indigo-600 animate-pulse" />
                  Role: {activeRoleName}
                </span>
              </div>
              <h1 className="text-lg font-bold tracking-tight text-slate-950 sm:text-xl">Officer command center</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden sm:flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200/80 px-3 py-1.5 text-xs">
              <span className="text-slate-500 font-medium">Logged in as:</span>
              <span className="font-bold text-slate-900">{activeRoleName}</span>
            </div>
            <span className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
              <span className={`size-2 rounded-full ${loadError ? "bg-rose-500" : "bg-emerald-500"}`} />
              {loadError ? "Sync issue" : lastSync ? `Synced ${lastSync.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Connecting"}
            </span>
            <button type="button" onClick={() => void fetchReports()} disabled={refreshing} className={`${BUTTON_FOCUS} flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50`}>
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1480px] space-y-6 px-4 pt-7 sm:px-7 lg:px-10">
        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-indigo-600">Live incident overview</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-[28px]">Operations overview</h2>
              <p className="mt-1 text-sm text-slate-500">Prioritize incoming reports and coordinate verified incidents.</p>
            </div>
            <span className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500"><Activity size={14} className="text-indigo-500" /> Auto-refresh every 15 seconds</span>
          </div>
          {loadError && <div role="alert" className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><AlertCircle size={17} /> {loadError} <button type="button" onClick={() => void fetchReports()} className="ml-auto font-semibold underline">Retry</button></div>}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <Metric label="Awaiting review" description="Reports needing a decision" count={counts.PENDING_REVIEW} selected={status === "PENDING_REVIEW" && severityFilter === "ALL"} onClick={() => { setStatus("PENDING_REVIEW"); setSeverityFilter("ALL"); }} icon={<Clock3 size={19} />} color="bg-amber-50 text-amber-600" />
            <Metric label="Verified incidents" description="Reviewed and approved" count={counts.VERIFIED} selected={status === "VERIFIED" && severityFilter === "ALL"} onClick={() => { setStatus("VERIFIED"); setSeverityFilter("ALL"); }} icon={<CheckCircle2 size={19} />} color="bg-emerald-50 text-emerald-600" />
            <Metric label="Rejected reports" description="Reviewed and dismissed" count={counts.REJECTED} selected={status === "REJECTED"} onClick={() => { setStatus("REJECTED"); setSeverityFilter("ALL"); }} icon={<XCircle size={19} />} color="bg-slate-100 text-slate-500" />
            <Metric label="High-severity threats" description="Verified critical incidents" count={counts.HIGH} selected={status === "VERIFIED" && severityFilter === "HIGH"} onClick={() => { setStatus("VERIFIED"); setSeverityFilter("HIGH"); }} icon={<AlertTriangle size={19} />} color="bg-rose-50 text-rose-600" />
          </div>
        </section>

        {criticalReports.length > 0 && (
          <section aria-label="Critical incidents" className="flex flex-wrap items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
            <span className="grid size-9 place-items-center rounded-xl bg-rose-100 text-rose-600"><AlertTriangle size={17} /></span>
            <div className="min-w-0 flex-1"><p className="text-sm font-bold text-rose-900">{criticalReports.length} verified high-severity {criticalReports.length === 1 ? "incident" : "incidents"}</p><p className="text-xs text-rose-700">Inspect the mapped locations and prepare appropriate response.</p></div>
            <button type="button" onClick={() => { setStatus("VERIFIED"); setSeverityFilter("HIGH"); document.getElementById("report-queue")?.scrollIntoView({ behavior: "smooth" }); }} className={`${BUTTON_FOCUS} rounded-lg bg-white px-3 py-2 text-xs font-bold text-rose-700 shadow-sm hover:bg-rose-100`}>View incidents <ArrowUpRight size={13} className="inline" /></button>
          </section>
        )}

        <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(320px,1fr)]">
          <section id="incident-map" className={`${PANEL} min-w-0 overflow-hidden`}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
              <SectionTitle eyebrow="Incident geography" title="Active verified incident map" detail={`${mappedReports.length} active ${mappedReports.length === 1 ? "report" : "reports"} · markers expire after 7 days`} />
              <div className="flex items-center gap-2">
                <span className="hidden items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 sm:flex"><MapPin size={13} /> Map view</span>
                <button type="button" onClick={() => setShowIncidentControls((value) => !value)} aria-expanded={showIncidentControls} aria-controls="incident-lifecycle" className={`${BUTTON_FOCUS} inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800`}><CheckCircle2 size={14} /> Manage incidents <ChevronDown size={14} className={showIncidentControls ? "rotate-180" : ""} /></button>
              </div>
            </div>
            <div className={`flex gap-2 overflow-x-auto px-4 py-3 ${HIDDEN_SCROLLBAR}`} aria-label="Hazard map filters">
              <button type="button" onClick={() => setHazard("ALL")} aria-pressed={hazard === "ALL"} className={`${BUTTON_FOCUS} shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition ${hazard === "ALL" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>All hazards</button>
              {HAZARD_KEYS.map((key) => <button key={key} type="button" onClick={() => setHazard(key)} aria-pressed={hazard === key} className={`${BUTTON_FOCUS} shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition ${hazard === key ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{HAZARD_META[key].icon} {HAZARD_META[key].label}</button>)}
            </div>
            <div className="relative h-[350px] bg-slate-100 sm:h-[425px] lg:h-[470px]"><DisasterMap reports={mappedReports} focusedId={focusedId} onSelect={setFocusedId} /></div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 px-4 py-3 sm:px-5">
              {HAZARD_KEYS.map((key) => <span key={key} className="flex items-center gap-1.5 text-[11px] text-slate-500"><span className="size-2 rounded-full" style={{ backgroundColor: HAZARD_META[key].color }} />{HAZARD_META[key].label}</span>)}
            </div>
          </section>

          <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <section className={`${PANEL} flex flex-col p-5`}>
              <SectionTitle eyebrow="Distribution" title="Reports by hazard" detail="Breakdown across all received reports" />
              {hazardStats.length ? <div className="mt-4 flex min-h-0 flex-1 items-center gap-3">
                <div className="h-40 w-[44%] min-w-0 shrink-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={hazardStats} dataKey="value" nameKey="label" innerRadius="59%" outerRadius="82%" paddingAngle={3} stroke="none">{hazardStats.map((item) => <Cell key={item.key} fill={item.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
                <div className="min-w-0 flex-1 space-y-2.5">{hazardStats.map((item) => <div key={item.key} className="flex items-center justify-between gap-2 text-xs"><span className="flex min-w-0 items-center gap-2 text-slate-600"><span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} /><span className="truncate">{item.label}</span></span><span className="font-bold text-slate-900 tabular-nums">{item.value}</span></div>)}</div>
              </div> : <div className="flex flex-1 items-center justify-center py-8 text-sm text-slate-400">No hazard data yet</div>}
            </section>
            <section className={`${PANEL} flex flex-col p-5`}>
              <SectionTitle eyebrow="Risk assessment" title="Verified by severity" detail="Severity levels assigned during review" />
              <div className="mt-4 min-h-[140px] flex-1"><ResponsiveContainer width="100%" height="100%"><BarChart data={severityStats} margin={{ top: 8, right: 4, left: -27, bottom: 0 }}><CartesianGrid strokeDasharray="3 4" vertical={false} stroke="#edf0f7" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} /><Tooltip cursor={{ fill: "#f8fafc" }} /><Bar dataKey="value" name="Reports" radius={[5, 5, 0, 0]} maxBarSize={44}>{severityStats.map((item) => <Cell key={item.name} fill={item.color} />)}</Bar></BarChart></ResponsiveContainer></div>
            </section>
          </div>
        </div>

        {showIncidentControls && <section id="incident-lifecycle" className={`${PANEL} overflow-hidden`} aria-labelledby="incident-lifecycle-heading">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
            <SectionTitle eyebrow="Map lifecycle" title="Incident controls" detail="Use evidence and location context to resolve an incident or extend its map visibility." />
            <span className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-700">{activeIncidents.length} active on map</span>
          </div>
          {managedIncidents.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[940px] text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <tr><th className="px-4 py-3.5 sm:px-5">Incident</th><th className="px-4 py-3.5">Evidence</th><th className="px-4 py-3.5">Reported</th><th className="px-4 py-3.5">Nearest location</th><th className="px-4 py-3.5">Map status</th><th className="px-4 py-3.5 text-right sm:px-5">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {managedIncidents.map((report) => {
                    const hazardInfo = hazardMeta(report.hazardType);
                    const legacyExpiry = new Date(report.captureTime).getTime() + MAP_INCIDENT_WINDOW_MS;
                    const expiresAt = report.mapVisibleUntil ? new Date(report.mapVisibleUntil).getTime() : legacyExpiry;
                    const expired = expiresAt <= mapNow;
                    const expiresSoon = !expired && expiresAt - mapNow <= 48 * 60 * 60 * 1000;
                    const photos = parsePhotos(report.photo);
                    return (
                      <tr key={report.id} className="bg-white">
                        <td className="px-4 py-3.5 sm:px-5"><div className="flex items-center gap-2.5"><span className={`grid size-8 place-items-center rounded-lg ${hazardInfo.tint}`}>{hazardInfo.icon}</span><div><p className="font-bold text-slate-900">{hazardInfo.label}</p><p className="mt-0.5 max-w-[240px] truncate text-xs text-slate-500">{report.description}</p></div></div></td>
                        <td className="px-4 py-3.5"><div className="flex -space-x-2">{photos.length ? photos.slice(0, 2).map((src, index) => <button key={`${src}-${index}`} type="button" onClick={() => setPhoto({ src, report })} className="size-9 overflow-hidden rounded-lg border-2 border-white bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"><img src={src} alt={`Evidence ${index + 1}`} className="size-full object-cover" /></button>) : <span className="grid size-9 place-items-center rounded-lg bg-slate-100 text-[10px] font-bold text-slate-400">None</span>}</div></td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-xs font-medium text-slate-600">{incidentDateLabel(report.captureTime)}</td>
                        <td className="px-4 py-3.5"><p className="text-xs font-semibold text-slate-700">{nearestLocationLabel(report.latitude, report.longitude)}</p><p className="mt-0.5 text-[11px] text-slate-400 tabular-nums">{report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}</p></td>
                        <td className="px-4 py-3.5"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${expired ? "bg-rose-50 text-rose-700" : expiresSoon ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{expiryLabel(report, mapNow)}</span></td>
                        <td className="px-4 py-3.5 text-right sm:px-5"><div className="flex justify-end gap-2"><button type="button" onClick={() => void updateIncidentLifecycle(report, "extend")} disabled={resolvingIncidentId !== null} className={`${BUTTON_FOCUS} rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60`}>{resolvingIncidentId === report.id ? "Updating..." : "Extend 7 days"}</button><button type="button" onClick={() => void updateIncidentLifecycle(report, "resolve")} disabled={resolvingIncidentId !== null} className={`${BUTTON_FOCUS} rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800 disabled:cursor-wait disabled:opacity-60`}>Resolve</button></div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <div className="px-5 py-9 text-center text-sm text-slate-500">No unresolved verified incidents need map management.</div>}
        </section>}

        <section id="report-queue" className="scroll-mt-5 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3"><SectionTitle eyebrow="Review workspace" title="Incoming report queue" detail="Review evidence, assign severity, and manage decisions." /><span className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700">{filtered.length} shown</span></div>
          <div className={`${PANEL} space-y-3 p-3 sm:p-4`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className={`flex max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 ${HIDDEN_SCROLLBAR}`} role="group" aria-label="Review status">
                {tabs.map((tab) => <button key={tab.key} type="button" onClick={() => setStatus(tab.key)} aria-pressed={status === tab.key} className={`${BUTTON_FOCUS} shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition ${status === tab.key ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{tab.label} <span className="ml-1 tabular-nums opacity-60">{tab.count}</span></button>)}
              </div>
              <button type="button" onClick={() => setShowFilters((value) => !value)} aria-expanded={showFilters} className={`${CONTROL} ${BUTTON_FOCUS} inline-flex items-center gap-2 font-semibold`}><SlidersHorizontal size={15} /> Filters <ChevronDown size={14} className={showFilters ? "rotate-180" : ""} /></button>
            </div>
            <div className="relative"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input aria-label="Search reports" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by hazard, report ID, or description..." className={`${CONTROL} w-full pl-10`} /></div>
            {showFilters && <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              <span className="flex items-center gap-1 text-xs text-slate-400"><ListFilter size={14} /> Refine:</span>
              <select aria-label="Severity filter" value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)} className={CONTROL}><option value="ALL">Any severity</option><option value="NONE">Not rated</option><option value="LOW">Low severity</option><option value="MEDIUM">Medium severity</option><option value="HIGH">High severity</option></select>
              <select aria-label="Evidence filter" value={photoFilter} onChange={(event) => setPhotoFilter(event.target.value)} className={CONTROL}><option value="ALL">Any evidence</option><option value="FULL">With photo</option><option value="REDUCED">No photo</option></select>
              <select aria-label="Hazard filter" value={hazard} onChange={(event) => setHazard(event.target.value)} className={CONTROL}><option value="ALL">All hazards</option>{HAZARD_KEYS.map((key) => <option key={key} value={key}>{HAZARD_META[key].label}</option>)}</select>
            </div>}
            {filtersActive && <button type="button" onClick={clearFilters} className={`${BUTTON_FOCUS} text-xs font-semibold text-indigo-600 hover:text-indigo-800`}>Clear all filters</button>}
          </div>
          {loading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((index) => <div key={index} className={`${PANEL} h-64 animate-pulse bg-slate-100`} />)}</div>
            : filtered.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((report) => <ReportCard key={report.id} report={report} mapVisible={mappedReportIds.has(report.id)} onReview={(action) => openReview(report, action)} onBroadcast={() => setDispatchTarget(report)} onFocus={() => focusOnMap(report.id)} onPhoto={(src) => setPhoto({ src, report })} />)}</div>
            : <div className={`${PANEL} py-16 text-center`}><div className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400"><Search size={21} /></div><h3 className="mt-3 text-sm font-bold text-slate-900">No matching reports</h3><p className="mt-1 text-sm text-slate-500">Adjust your search or filters to see more incidents.</p><button type="button" onClick={clearFilters} className="mt-4 text-sm font-semibold text-indigo-600 hover:underline">Clear filters</button></div>}
        </section>
      </main>

      {review && <Modal title={review.action === "verify" ? "Verify incident report" : "Reject incident report"} description={`${hazardMeta(review.report.hazardType).label} · ${timeAgo(review.report.captureTime)}`} onClose={() => setReview(null)} busy={busy}>
        <p className="rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">{review.report.description}</p>
        {actionError && <p role="alert" className="mt-3 flex gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700"><AlertCircle size={17} className="shrink-0" />{actionError}</p>}
        {review.action === "verify" ? <fieldset className="mt-5"><legend className="mb-3 text-sm font-bold text-slate-800">Choose incident severity</legend><div className="grid grid-cols-3 gap-2">{(Object.keys(SEVERITY_META) as Severity[]).map((key) => <button key={key} type="button" onClick={() => setReviewSeverity(key)} aria-pressed={reviewSeverity === key} className={`${BUTTON_FOCUS} rounded-xl border-2 px-2 py-3 text-sm font-semibold ${reviewSeverity === key ? SEVERITY_META[key].pick : "border-slate-100 bg-slate-50 text-slate-600"}`}>{SEVERITY_META[key].label}</button>)}</div></fieldset>
          : <div className="mt-5"><label htmlFor="reject-reason" className="text-sm font-bold text-slate-800">Reason for rejection</label><div className="mt-3 flex flex-wrap gap-2">{REJECTION_REASONS.map((reason) => <button key={reason} type="button" onClick={() => setRejectReason(reason)} className={`${BUTTON_FOCUS} rounded-lg px-2.5 py-1.5 text-xs font-semibold ${rejectReason === reason ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}>{reason}</button>)}</div><textarea id="reject-reason" rows={3} value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Explain the rejection clearly..." className={`${CONTROL} mt-3 w-full resize-y`} /></div>}
        <div className="mt-6 grid grid-cols-2 gap-2"><button type="button" disabled={busy} onClick={() => setReview(null)} className={`${BUTTON_FOCUS} rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-700 disabled:opacity-50`}>Cancel</button><button type="button" onClick={() => void submitReview()} disabled={busy || (review.action === "reject" && !rejectReason.trim())} className={`${BUTTON_FOCUS} rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50 ${review.action === "verify" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-rose-600 hover:bg-rose-700"}`}>{busy ? "Saving..." : review.action === "verify" ? "Confirm verification" : "Reject report"}</button></div>
      </Modal>}

      {dispatchTarget && <Modal title="Emergency dispatch" description="High-severity verified incident" onClose={() => setDispatchTarget(null)}>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="flex items-center gap-2 text-sm font-bold text-amber-900"><AlertTriangle size={17} /> Dispatch integration required</p><p className="mt-2 text-sm leading-6 text-amber-800">The current dashboard does not include a working dispatch API. No SMS, siren, or emergency notification has been sent. Connect and authorize your UC1 dispatch endpoint before enabling this action.</p></div>
        <p className="mt-4 text-sm text-slate-600">Incident: <strong>{hazardMeta(dispatchTarget.hazardType).label}</strong> at {dispatchTarget.latitude.toFixed(4)}, {dispatchTarget.longitude.toFixed(4)}</p>
        <button type="button" onClick={() => setDispatchTarget(null)} className={`${BUTTON_FOCUS} mt-5 w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white hover:bg-slate-800`}>Close</button>
      </Modal>}

      {photo && <div role="dialog" aria-modal="true" aria-label="Incident evidence photo" className="fixed inset-0 z-[2100] flex flex-col items-center justify-center bg-slate-950/95 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setPhoto(null); }}>
        <button type="button" onClick={() => setPhoto(null)} aria-label="Close evidence" className={`${BUTTON_FOCUS} absolute right-5 top-5 rounded-full bg-white/10 p-3 text-white hover:bg-white/20`}><X size={21} /></button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.src} alt={`Evidence for ${hazardMeta(photo.report.hazardType).label}`} className="max-h-[75vh] max-w-full rounded-xl object-contain" />
        <p className="mt-4 max-w-3xl text-center text-sm text-white/80">{photo.report.description}</p>
      </div>}

      {notice && <div role="status" className="fixed bottom-5 left-1/2 z-[2200] flex max-w-[90vw] -translate-x-1/2 items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-xl"><CheckCircle2 size={17} className="text-emerald-400" />{notice}</div>}
    </div>
  );
}
