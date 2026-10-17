"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Clock3,
  Image as ImageIcon,
  MapPin,
  RefreshCw,
  ArrowUpRight,
  X,
  ZoomIn,
} from "lucide-react";
import { CreativeDewecsLogo } from "@/components/CreativeDewecsLogo";
import { DEMO_CITIZEN_ID } from "@/modules/uc2-report/client/citizen";
import { hazardMeta, parsePhotos, timeAgo } from "@/modules/uc2-report/client/reportUi";
import { useAutoRefresh } from "@/shared/hooks/useAutoRefresh";

type CitizenReport = {
  id: string;
  hazardType: string;
  description: string;
  captureTime: string;
  reviewStatus: "PENDING_REVIEW" | "NEEDS_INFO" | "VERIFIED" | "REJECTED";
  severityIndication?: "LOW" | "MEDIUM" | "HIGH";
  latitude: number;
  longitude: number;
  photo?: string | null;
};

const STATUS = {
  PENDING_REVIEW: {
    label: "Awaiting review",
    classes: "bg-amber-50 text-amber-800 border-amber-200",
    icon: Clock3,
  },
  NEEDS_INFO: {
    label: "More info needed",
    classes: "bg-sky-50 text-sky-800 border-sky-200",
    icon: AlertCircle,
  },
  VERIFIED: {
    label: "Verified",
    classes: "bg-emerald-50 text-emerald-800 border-emerald-200",
    icon: CheckCircle2,
  },
  REJECTED: {
    label: "Not accepted",
    classes: "bg-red-50 text-red-800 border-red-200",
    icon: AlertCircle,
  },
} as const;

function ReportCard({
  report,
  onPhotoSelect,
}: {
  report: CitizenReport;
  onPhotoSelect?: (photoUrl: string, report: CitizenReport) => void;
}) {
  const hazard = hazardMeta(report.hazardType);
  const status = STATUS[report.reviewStatus] ?? STATUS.PENDING_REVIEW;
  const StatusIcon = status.icon;
  const hasLocation = Number.isFinite(report.latitude) && Number.isFinite(report.longitude);
  const photos = parsePhotos(report.photo);

  return (
    <li>
      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-3">
          <div
            aria-hidden="true"
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl ${hazard.tint}`}
          >
            {hazard.icon}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold leading-6 text-slate-900">{hazard.label}</h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
              <Clock3 aria-hidden="true" size={13} />
              <time dateTime={report.captureTime}>{timeAgo(report.captureTime)}</time>
            </p>
          </div>
        </div>

        <div className="mt-3">
          <span
            className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${status.classes}`}
          >
            <StatusIcon aria-hidden="true" size={14} className="shrink-0" />
            {status.label}
          </span>
        </div>

        {report.description?.trim() && (
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
            {report.description}
          </p>
        )}

        {/* Display attached images if report has photos */}
        {photos.length > 0 && (
          <div className="mt-3.5">
            <div
              className={`grid gap-2 ${
                photos.length === 1
                  ? "grid-cols-1"
                  : photos.length === 2
                    ? "grid-cols-2"
                    : "grid-cols-3"
              }`}
            >
              {photos.map((src, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onPhotoSelect?.(src, report)}
                  className={`group relative overflow-hidden rounded-xl border border-slate-200/90 bg-slate-100 transition-all hover:border-teal-500/50 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 ${
                    photos.length === 1
                      ? "aspect-video max-h-56 w-full"
                      : "aspect-square w-full"
                  }`}
                  aria-label={`View photo ${idx + 1} of ${hazard.label} report in full`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`${hazard.label} report evidence ${idx + 1}`}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/0 transition-colors group-hover:bg-slate-900/25">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-950/75 text-white opacity-0 shadow-sm backdrop-blur-xs transition-opacity group-hover:opacity-100">
                      <ZoomIn size={15} />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
          {photos.length > 0 && (
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
              <ImageIcon aria-hidden="true" size={14} className="text-slate-400" />
              {photos.length} {photos.length === 1 ? "photo" : "photos"}
            </span>
          )}
          {hasLocation && (
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <MapPin aria-hidden="true" size={14} />
              {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}
            </span>
          )}
          {report.severityIndication && (
            <span className="font-medium text-slate-600">
              {report.severityIndication.charAt(0) + report.severityIndication.slice(1).toLowerCase()} severity
            </span>
          )}
        </div>
      </article>
    </li>
  );
}

export default function ReportHistoryPage() {
  const [reports, setReports] = useState<CitizenReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activePhoto, setActivePhoto] = useState<{ src: string; report: CitizenReport } | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActivePhoto(null);
      }
    };
    if (activePhoto) {
      window.addEventListener("keydown", onKeyDown);
    }
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activePhoto]);

  const loadReports = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    if (!background) setError("");
    try {
      const response = await fetch(
        `/api/reports/mine?reporterId=${encodeURIComponent(DEMO_CITIZEN_ID)}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("Could not load your reports.");

      const data: unknown = await response.json();
      if (!Array.isArray(data)) throw new Error("Received an unexpected report list.");
      setReports(data as CitizenReport[]);
    } catch (err) {
      if (!background) setError(err instanceof Error ? err.message : "Could not load your reports.");
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);
  useAutoRefresh(() => void loadReports(true));

  const sortedReports = [...reports].sort(
    (a, b) => new Date(b.captureTime).getTime() - new Date(a.captureTime).getTime(),
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-xl px-4 pb-5 pt-4 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Link
                href="/report/outbox"
                aria-label="Back to outbox"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
              >
                <ChevronLeft size={22} />
              </Link>
              <CreativeDewecsLogo variant="light" size="sm" showTagline={false} />
            </div>
            <button
              type="button"
              onClick={() => void loadReports()}
              disabled={loading}
              aria-label="Refresh sent reports"
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              <span className="hidden min-[360px]:inline">Refresh</span>
            </button>
          </div>

          <h1 className="mt-5 text-2xl font-bold tracking-tight">Sent reports</h1>
          <p className="mt-1 text-sm leading-5 text-slate-600">
            Check the review status of hazards you reported.
          </p>

          <nav aria-label="Reporting navigation" className="mt-4 flex flex-wrap gap-2">
            <Link href="/report/new" className="rounded-full border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
              New report
            </Link>
            <Link href="/report/alerts" className="rounded-full border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
              Active alerts
            </Link>
            <Link href="/report/outbox" className="rounded-full border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
              Outbox
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 pb-12 pt-6 sm:px-6">
        {loading ? (
          <section role="status" aria-live="polite" className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center">
            <RefreshCw size={24} className="mx-auto animate-spin text-teal-700" />
            <p className="mt-3 text-sm text-slate-600">Loading your reports…</p>
          </section>
        ) : error ? (
          <section role="alert" className="rounded-2xl border border-red-200 bg-white px-6 py-10 text-center">
            <AlertCircle className="mx-auto text-red-600" size={28} />
            <h2 className="mt-3 text-base font-semibold">Couldn&apos;t load reports</h2>
            <p className="mt-1 text-sm text-slate-600">{error}</p>
            <button type="button" onClick={() => void loadReports()} className="mt-5 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800">
              Try again
            </button>
          </section>
        ) : sortedReports.length === 0 ? (
          <section className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
              <ClipboardList size={28} />
            </div>
            <h2 className="mt-4 text-lg font-semibold">No sent reports yet</h2>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-600">
              Reports will appear here after they are successfully delivered.
            </p>
            <Link href="/report/new" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800">
              Report a hazard <ArrowUpRight size={16} />
            </Link>
          </section>
        ) : (
          <section aria-label="Sent report history">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-800">Your reports</h2>
              <span className="text-xs font-medium text-slate-500">
                {sortedReports.length} {sortedReports.length === 1 ? "report" : "reports"}
              </span>
            </div>
            <ul className="space-y-3">
              {sortedReports.map((report) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  onPhotoSelect={(src, rep) => setActivePhoto({ src, report: rep })}
                />
              ))}
            </ul>
          </section>
        )}
      </main>

      {/* Fullscreen Photo Lightbox Modal */}
      {activePhoto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Enlarged photo preview"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm"
          onClick={() => setActivePhoto(null)}
        >
          <div
            className="relative flex max-h-[90vh] max-w-2xl w-full flex-col items-center justify-center overflow-hidden rounded-2xl bg-slate-900 shadow-2xl border border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActivePhoto(null)}
              aria-label="Close photo preview"
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-slate-950/70 text-white backdrop-blur-sm transition-colors hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
              <X size={18} />
            </button>

            <div className="flex max-h-[75vh] w-full items-center justify-center overflow-hidden bg-black p-1 sm:p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activePhoto.src}
                alt="Enlarged report photo"
                className="max-h-[72vh] w-auto max-w-full rounded-lg object-contain"
              />
            </div>

            <div className="w-full border-t border-slate-800 bg-slate-900/95 px-4 py-3 text-white">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-teal-300">
                  {hazardMeta(activePhoto.report.hazardType).label} Report Photo
                </span>
                <span className="text-xs text-slate-400">
                  {timeAgo(activePhoto.report.captureTime)}
                </span>
              </div>
              {activePhoto.report.description && (
                <p className="mt-1 line-clamp-2 text-xs text-slate-300">
                  {activePhoto.report.description}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
