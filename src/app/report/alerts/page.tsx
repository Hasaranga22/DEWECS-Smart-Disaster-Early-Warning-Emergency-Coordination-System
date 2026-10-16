"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  Camera,
  ChevronDown,
  ChevronLeft,
  Clock3,
  ExternalLink,
  ImageOff,
  MapPin,
  Phone,
  RefreshCw,
  X,
  ZoomIn,
} from "lucide-react";
import { CreativeDewecsLogo } from "@/components/CreativeDewecsLogo";
import { hazardMeta, timeAgo } from "@/modules/uc2-report/client/reportUi";

export interface RelevantReportImage {
  id: string;
  url: string;
  caption?: string;
  districtName?: string;
  captureTime?: string;
  reviewStatus?: string;
}

export interface ActiveAlert {
  id: string;
  title: string;
  hazardType: "FLOOD" | "LANDSLIDE" | "CYCLONE" | "DROUGHT" | "OTHER";
  severity: "EMERGENCY" | "WARNING" | "WATCH" | "ADVISORY";
  status: "ACTIVE" | "ESCALATED";
  message: string;
  occurredAt: string;
  expiresAt: string | null;
  districts: { id: string; name: string }[];
  images?: RelevantReportImage[];
}

export interface DistrictItem {
  id: string;
  name: string;
}

const SEVERITY = {
  EMERGENCY: {
    label: "Emergency",
    badge: "bg-red-50 text-red-700 border-red-200",
    stripe: "bg-red-600",
  },
  WARNING: {
    label: "Warning",
    badge: "bg-amber-50 text-amber-800 border-amber-200",
    stripe: "bg-amber-500",
  },
  WATCH: {
    label: "Watch",
    badge: "bg-yellow-50 text-yellow-800 border-yellow-200",
    stripe: "bg-yellow-500",
  },
  ADVISORY: {
    label: "Advisory",
    badge: "bg-sky-50 text-sky-800 border-sky-200",
    stripe: "bg-sky-500",
  },
} as const;

const PRIORITY: Record<ActiveAlert["severity"], number> = {
  EMERGENCY: 4,
  WARNING: 3,
  WATCH: 2,
  ADVISORY: 1,
};

const REFRESH_INTERVAL_MS = 30_000;

export default function ActiveAlertsPage() {
  const [alerts, setAlerts] = useState<ActiveAlert[]>([]);
  const [districts, setDistricts] = useState<DistrictItem[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeImage, setActiveImage] = useState<{ image: RelevantReportImage; alert: ActiveAlert } | null>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveImage(null);
    };
    if (activeImage) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeImage]);

  const loadAlerts = useCallback(async (manual = false) => {
    const request = ++requestRef.current;
    if (manual) setRefreshing(true);

    try {
      const response = await fetch("/api/alerts/active", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to retrieve the latest alerts.");

      const data: { alerts?: ActiveAlert[]; districts?: DistrictItem[] } = await response.json();
      if (!Array.isArray(data.alerts)) throw new Error("The alert service returned invalid data.");
      if (request !== requestRef.current) return;

      setAlerts(data.alerts);
      if (Array.isArray(data.districts)) setDistricts(data.districts);
      setLastUpdated(new Date());
      setError("");
    } catch (cause) {
      if (request !== requestRef.current) return;
      setError(cause instanceof Error ? cause.message : "Unable to retrieve the latest alerts.");
    } finally {
      if (request === requestRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadAlerts();
    const interval = window.setInterval(() => void loadAlerts(), REFRESH_INTERVAL_MS);
    return () => {
      window.clearInterval(interval);
      requestRef.current += 1;
    };
  }, [loadAlerts]);

  const filteredAlerts = useMemo(() => {
    const current = alerts.filter((alert) => {
      const notExpired = !alert.expiresAt || new Date(alert.expiresAt).getTime() > Date.now();
      const matchingDistrict =
        selectedDistrict === "ALL" ||
        alert.districts.some((district) => district.id === selectedDistrict);
      return notExpired && matchingDistrict;
    });

    return current.sort((a, b) =>
      PRIORITY[b.severity] - PRIORITY[a.severity] ||
      new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
    );
  }, [alerts, selectedDistrict]);

  const selectedName = districts.find((district) => district.id === selectedDistrict)?.name;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-2xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href="/report/new"
                aria-label="Back to reporting"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600"
              >
                <ChevronLeft size={20} />
              </Link>
              <CreativeDewecsLogo variant="light" size="sm" showTagline={false} />
            </div>
            <button
              type="button"
              onClick={() => void loadAlerts(true)}
              disabled={refreshing || loading}
              aria-label="Refresh alerts"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
          <div className="mt-5">
            <h1 className="text-2xl font-bold tracking-tight">Active alerts</h1>
            <p className="mt-1 text-sm text-slate-600">
              Disaster warnings and advisories across Sri Lanka.
            </p>
          </div>
          <nav aria-label="Report navigation" className="mt-4 flex flex-wrap gap-2 text-sm">
            <Link href="/report/new" className="rounded-lg border border-slate-200 px-3 py-2 text-slate-700 hover:bg-slate-50">New report</Link>
            <Link href="/report/outbox" className="rounded-lg border border-slate-200 px-3 py-2 text-slate-700 hover:bg-slate-50">Outbox</Link>
            <Link href="/report/history" className="rounded-lg border border-slate-200 px-3 py-2 text-slate-700 hover:bg-slate-50">Sent reports</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-6 sm:px-6">
        <section aria-label="District filter" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <label htmlFor="district-filter" className="mb-2 block text-sm font-semibold">District</label>
          <div className="relative">
            <select
              id="district-filter"
              value={selectedDistrict}
              onChange={(event) => setSelectedDistrict(event.target.value)}
              className="min-h-12 w-full appearance-none rounded-xl border border-slate-300 bg-white px-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              <option value="ALL">All districts</option>
              {districts.map((district) => (
                <option key={district.id} value={district.id}>{district.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-3.5 text-slate-500" size={19} />
          </div>
        </section>

        {error && (
          <div role="alert" className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <AlertCircle size={19} className="mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">Latest alert status unavailable</p>
              <p className="mt-1">{error} Previously loaded results may be out of date.</p>
              <button type="button" onClick={() => void loadAlerts(true)} className="mt-2 font-semibold underline underline-offset-2">Try again</button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-800">
            {loading ? "Checking alerts…" : `${filteredAlerts.length} alert${filteredAlerts.length === 1 ? "" : "s"}${selectedName ? ` · ${selectedName}` : ""}`}
          </h2>
          {lastUpdated && !error && (
            <span className="text-xs text-slate-500">Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          )}
        </div>

        {loading ? (
          <div role="status" className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-10 text-sm text-slate-600">
            <RefreshCw className="animate-spin text-teal-700" size={20} /> Loading alerts…
          </div>
        ) : error && !lastUpdated ? null : filteredAlerts.length === 0 ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <AlertTriangle size={30} className="mx-auto text-slate-400" />
            <h3 className="mt-3 font-semibold">No active alerts listed</h3>
            <p className="mt-2 text-sm text-slate-600">
              {selectedName ? `No active alerts are currently listed for ${selectedName}.` : "No active alerts are currently listed in the feed."}
              {" "}This does not guarantee the area is safe.
            </p>
            {selectedDistrict !== "ALL" && (
              <button type="button" onClick={() => setSelectedDistrict("ALL")} className="mt-4 text-sm font-semibold text-teal-700 underline underline-offset-2">View all districts</button>
            )}
          </section>
        ) : (
          <ul className="space-y-3">
            {filteredAlerts.map((alert) => {
              const hazard = hazardMeta(alert.hazardType);
              const severity = SEVERITY[alert.severity];
              return (
                <li key={alert.id}>
                  <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className={`h-1 ${severity.stripe}`} />
                    <div className="p-4 sm:p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${severity.badge}`}>{severity.label}</span>
                        <span className="text-xs text-slate-500">{hazard.label}</span>
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Clock3 size={13} /> {timeAgo(alert.occurredAt)}</span>
                      </div>
                      <h3 className="mt-3 text-base font-bold leading-snug sm:text-lg">{alert.title}</h3>
                      <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-slate-700">{alert.message}</p>

                      {/* Relevant Ground Report Images */}
                      {alert.images && alert.images.length > 0 ? (
                        <div className="mt-4 rounded-xl border border-slate-200/90 bg-slate-50/80 p-3 sm:p-3.5">
                          <div className="flex items-center justify-between gap-2 mb-2.5">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                              <Camera size={14} className="text-teal-700" />
                              <span>Ground situation photos & field evidence</span>
                            </div>
                            <span className="text-[11px] font-semibold text-slate-500 bg-white border border-slate-200/80 px-2 py-0.5 rounded-full">
                              {alert.images.length} {alert.images.length === 1 ? "report photo" : "report photos"}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {alert.images.map((img, idx) => (
                              <button
                                key={img.id || idx}
                                type="button"
                                onClick={() => setActiveImage({ image: img, alert })}
                                className="group relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-slate-200 border border-slate-200 shadow-2xs hover:shadow-md transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600"
                                aria-label={`View full report photo: ${img.caption || alert.title}`}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={img.url}
                                  alt={img.caption || `${alert.hazardType} field report evidence`}
                                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                  loading="lazy"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-80 group-hover:opacity-95 transition-opacity" />

                                {img.districtName && (
                                  <span className="absolute top-1.5 left-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-950/80 text-white backdrop-blur-xs">
                                    {img.districtName}
                                  </span>
                                )}

                                <div className="absolute bottom-1.5 inset-x-1.5 flex items-end justify-between gap-1 text-white">
                                  <span className="text-[10px] line-clamp-1 font-medium text-slate-100 leading-tight">
                                    {img.caption || "Citizen ground report"}
                                  </span>
                                  <span className="shrink-0 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-white/25 text-white backdrop-blur-xs">
                                    <ZoomIn size={11} />
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500 border border-dashed border-slate-200">
                          <span className="inline-flex items-center gap-1.5">
                            <ImageOff size={13} className="text-slate-400" />
                            No field photos reported yet for this alert
                          </span>
                          <Link href="/report/new" className="font-semibold text-teal-700 hover:underline">
                            Submit photo
                          </Link>
                        </div>
                      )}

                      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                        <MapPin size={14} className="shrink-0" />
                        <span className="font-semibold">Affected:</span>
                        {alert.districts.length ? alert.districts.map((district) => (
                          <button
                            key={district.id}
                            type="button"
                            onClick={() => setSelectedDistrict(district.id)}
                            className="rounded-md bg-slate-100 px-2 py-1 font-medium hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600"
                          >{district.name}</button>
                        )) : <span>Not specified</span>}
                      </div>
                      <Link href="/report/new" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:underline">
                        Report ground situation <ExternalLink size={14} />
                      </Link>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}

        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <div>
            <p className="text-xs text-slate-500">Disaster Management Centre</p>
            <h2 className="mt-1 font-semibold">Emergency hotline · 117</h2>
          </div>
          <a href="tel:117" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700">
            <Phone size={16} /> Call 117
          </a>
        </section>
      </main>

      {/* Fullscreen Ground Photo Lightbox */}
      {activeImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Enlarged disaster report photo"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm"
          onClick={() => setActiveImage(null)}
        >
          <div
            className="relative flex max-h-[90vh] max-w-2xl w-full flex-col items-center justify-center overflow-hidden rounded-2xl bg-slate-900 shadow-2xl border border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveImage(null)}
              aria-label="Close photo preview"
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-slate-950/70 text-white backdrop-blur-sm transition-colors hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
              <X size={18} />
            </button>

            <div className="flex max-h-[75vh] w-full items-center justify-center overflow-hidden bg-black p-1 sm:p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeImage.image.url}
                alt={activeImage.image.caption || "Ground report photo"}
                className="max-h-[72vh] w-auto max-w-full rounded-lg object-contain"
              />
            </div>

            <div className="w-full border-t border-slate-800 bg-slate-900/95 px-4 py-3.5 text-white">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-teal-300">
                    {activeImage.image.districtName ? `${activeImage.image.districtName} · ` : ""}
                    {hazardMeta(activeImage.alert.hazardType).label} Evidence
                  </span>
                  {activeImage.image.reviewStatus && (
                    <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                      {activeImage.image.reviewStatus}
                    </span>
                  )}
                </div>
                {activeImage.image.captureTime && (
                  <span className="text-xs text-slate-400">
                    {timeAgo(activeImage.image.captureTime)}
                  </span>
                )}
              </div>
              {activeImage.image.caption && (
                <p className="mt-1.5 text-xs sm:text-sm text-slate-200 leading-relaxed font-normal">
                  {activeImage.image.caption}
                </p>
              )}
              <p className="mt-1 text-[11px] text-slate-400">
                Alert: <span className="text-slate-300 font-medium">{activeImage.alert.title}</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
