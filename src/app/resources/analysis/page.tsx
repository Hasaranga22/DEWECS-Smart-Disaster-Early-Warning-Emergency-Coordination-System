"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FileBarChart,
  Calendar,
  Filter,
  Layers,
  Globe,
  Loader2,
  X,
  RotateCcw,
  ArrowRight,
  Activity,
  Radio,
} from "lucide-react";
import {
  api,
  ApiError,
  DISTRICTS,
  HAZARD_TYPES,
  PRESETS,
  SECTIONS,
  LANGUAGES,
  toIsoRange,
  daysBetween,
  formatDate,
  formatNumber,
  type LiveMetricsResponse,
} from "./_types";
import { prefillFromQuery } from "./_prefill";
import { Card, CardTitle, Banner } from "./_components";

const DEFAULT_FROM = "2026-08-01";
const DEFAULT_TO = "2026-08-31";

export default function GenerateReportPage() {
  return (
    <Suspense fallback={null}>
      <AnalysisForm />
    </Suspense>
  );
}

function AnalysisForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefill = prefillFromQuery(Object.fromEntries(searchParams.entries()));

  const [from, setFrom] = useState<string>(prefill.from ?? DEFAULT_FROM);
  const [to, setTo] = useState<string>(prefill.to ?? DEFAULT_TO);
  const [districtId, setDistrictId] = useState<string>(prefill.districtId ?? "");
  const [hazardType, setHazardType] = useState<string>(prefill.hazardType ?? "");
  const [includedSections, setIncludedSections] = useState<Set<string>>(
    new Set(SECTIONS)
  );
  const [language, setLanguage] = useState<"EN" | "SI" | "TA">(prefill.language ?? "EN");

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<{
    type: "success" | "error" | "warn" | "info";
    message: string;
  } | null>(null);

  // Live (non-frozen) metrics — polls the shared DB every 15s while enabled.
  const [liveOn, setLiveOn] = useState<boolean>(false);
  const [liveData, setLiveData] = useState<LiveMetricsResponse | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [liveLoading, setLiveLoading] = useState<boolean>(false);
  const liveSeq = useRef(0);

  // Live Inline Validations
  const isFromAfterTo = Boolean(from && to && new Date(from).getTime() > new Date(to).getTime());
  const rangeDays = from && to ? daysBetween(from, to) : 0;
  const isRangeTooLong = rangeDays > 365;
  const isNoSectionSelected = includedSections.size === 0;

  const isValid =
    Boolean(from) &&
    Boolean(to) &&
    !isFromAfterTo &&
    !isRangeTooLong &&
    !isNoSectionSelected;

  // Poll live metrics every 15s while the toggle is on (and when filters change).
  useEffect(() => {
    if (!liveOn || !from || !to || isFromAfterTo || isRangeTooLong) return;
    const seq = ++liveSeq.current;
    let cancelled = false;

    const load = async () => {
      setLiveLoading(true);
      try {
        const iso = toIsoRange(from, to);
        const res = await api.fetchLive({
          from: iso.from,
          to: iso.to,
          districtId: districtId.trim() || undefined,
          hazardType: hazardType.trim() || undefined,
        });
        if (!cancelled && seq === liveSeq.current) {
          setLiveData(res);
          setLiveError(null);
        }
      } catch (err) {
        if (!cancelled && seq === liveSeq.current) {
          setLiveError(err instanceof Error ? err.message : "Failed to load live metrics");
        }
      } finally {
        if (!cancelled && seq === liveSeq.current) setLiveLoading(false);
      }
    };

    load();
    const timer = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [liveOn, from, to, districtId, hazardType, isFromAfterTo, isRangeTooLong]);

  const toggleSection = (sec: string) => {
    const next = new Set(includedSections);
    if (next.has(sec)) {
      next.delete(sec);
    } else {
      next.add(sec);
    }
    setIncludedSections(next);
  };

  const handleReset = () => {
    setFrom(DEFAULT_FROM);
    setTo(DEFAULT_TO);
    setDistrictId("");
    setHazardType("");
    setIncludedSections(new Set(SECTIONS));
    setLanguage("EN");
    setSubmitting(false);
    setFieldErrors({});
    setBanner(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || submitting) return;

    setSubmitting(true);
    setBanner(null);
    setFieldErrors({});

    try {
      const isoRange = toIsoRange(from, to);
      const res = await api.generateReport({
        from: isoRange.from,
        to: isoRange.to,
        districtId: districtId.trim() ? districtId : undefined,
        hazardType: hazardType.trim() ? hazardType : undefined,
        includedSections: Array.from(includedSections),
        language,
      });

      router.push(`/resources/analysis/${res.reportId}`);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 400) {
          const details = err.details as { fields?: Record<string, string> } | null;
          if (details?.fields) {
            setFieldErrors(details.fields);
          }
          setBanner({
            type: "error",
            message: `Validation failed: ${err.message}`,
          });
        } else if (err.status === 403) {
          setBanner({
            type: "error",
            message: "Access denied - DMC Official role required",
          });
        } else if (err.status === 503) {
          setBanner({
            type: "warn",
            message: "Aggregation timed out. Retry with narrower scope.",
          });
        } else {
          setBanner({
            type: "error",
            message: `Server error (${err.status}): ${err.message}`,
          });
        }
      } else {
        const msg = err instanceof Error ? err.message : "Network error";
        setBanner({
          type: "error",
          message: `Failed to generate report: ${msg}`,
        });
      }
      setSubmitting(false);
    }
  };

  const selectedDistrictObj = DISTRICTS.find((d) => d.id === districtId);

  return (
    <div className="space-y-6">
      {/* Title Card */}
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-sm font-bold text-white flex items-center gap-2">
            <FileBarChart className="w-5 h-5 text-blue-400" /> Generate Post-Event Report
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Select period, filters, and included sections to generate a post-event analysis report.
          </p>
        </div>
      </Card>

      {/* Banner Feedback */}
      {banner && (
        <Banner type={banner.type} onClose={() => setBanner(null)}>
          {banner.message}
        </Banner>
      )}

      {/* Live Metrics Card */}
      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle>
            <span className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" /> Live Database Metrics
            </span>
          </CardTitle>
          <button
            type="button"
            onClick={() => setLiveOn((v) => !v)}
            aria-pressed={liveOn}
            className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition flex items-center gap-1.5 ${
              liveOn
                ? "bg-emerald-950 border-emerald-700 text-emerald-300"
                : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600"
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${liveOn ? "animate-pulse" : ""}`} />
            {liveOn ? "Live ON" : "Go Live"}
          </button>
        </div>

        {liveOn && (
          <>
            <p className="text-[11px] text-slate-500">
              Reads the shared database every 15s — reflects alerts, ground reports, shelters and supplies
              written by all modules. Nothing is saved until you generate a report below.
            </p>
            {liveError && (
              <Banner type="error" onClose={() => setLiveError(null)}>
                Live metrics error: {liveError}
              </Banner>
            )}
            {liveData ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Alerts</div>
                  <div className="text-xl font-bold text-white tabular-nums">
                    {formatNumber(liveData.metrics.alerts.total)}
                  </div>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Citizens Reached</div>
                  <div className="text-xl font-bold text-white tabular-nums">
                    {formatNumber(liveData.metrics.reach.distinctCitizens)}
                  </div>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Reports (V/P/R)</div>
                  <div className="text-xl font-bold text-white tabular-nums">
                    {liveData.metrics.reports.verified}/{liveData.metrics.reports.pending}/
                    {liveData.metrics.reports.rejected}
                  </div>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Shelters</div>
                  <div className="text-xl font-bold text-white tabular-nums">
                    {formatNumber(liveData.metrics.shelters.activated)}
                  </div>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Supply Types</div>
                  <div className="text-xl font-bold text-white tabular-nums">
                    {Object.keys(liveData.metrics.supplies.byType).length}
                  </div>
                </div>
              </div>
            ) : (
              !liveError && (
                <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                  <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" /> Loading live metrics...
                </div>
              )
            )}
            {liveData && (
              <div className="text-[10px] text-slate-600 flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Last updated {formatDate(liveData.generatedAt)} · auto-refreshes every 15s
              </div>
            )}
          </>
        )}
      </Card>

      {/* Progress Banner while submitting */}
      {submitting && (
        <div aria-live="polite">
          <Banner type="info">
            <div className="flex items-center justify-between w-full gap-4">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
                <span>
                  Generating report...
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSubmitting(false)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold rounded-lg border border-slate-700 transition shrink-0"
              >
                Cancel
              </button>
            </div>
          </Banner>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Reporting Period Card */}
          <Card className="space-y-4">
            <CardTitle>
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-400" /> Reporting Period
              </span>
            </CardTitle>
            <div className="space-y-3">
              <div>
                <label htmlFor="from-date" className="block text-xs text-slate-400 mb-1 font-medium">
                  From Date <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  id="from-date"
                  required
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className={`w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-blue-500 ${
                    isFromAfterTo || fieldErrors.from
                      ? "border-red-500 ring-1 ring-red-500"
                      : ""
                  }`}
                />
                {isFromAfterTo && (
                  <p aria-live="polite" className="text-[11px] text-red-400 mt-1 font-medium">
                    Start date must be before end date
                  </p>
                )}
                {fieldErrors.from && (
                  <p aria-live="polite" className="text-[11px] text-red-400 mt-1">
                    {fieldErrors.from}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="to-date" className="block text-xs text-slate-400 mb-1 font-medium">
                  To Date <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  id="to-date"
                  required
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className={`w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-blue-500 ${
                    isRangeTooLong || fieldErrors.to
                      ? "border-red-500 ring-1 ring-red-500"
                      : ""
                  }`}
                />
                {isRangeTooLong && (
                  <p aria-live="polite" className="text-[11px] text-red-400 mt-1 font-medium">
                    Maximum period range is 365 days
                  </p>
                )}
                {fieldErrors.to && (
                  <p aria-live="polite" className="text-[11px] text-red-400 mt-1">
                    {fieldErrors.to}
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* Filters Card */}
          <Card className="space-y-4">
            <CardTitle>
              <span className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-blue-400" /> Filters
              </span>
            </CardTitle>
            <div>
              <span className="block text-xs text-slate-400 mb-1 font-medium">
                Demo presets
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setFrom(p.from);
                      setTo(p.to);
                      setDistrictId(p.districtId);
                      setHazardType(p.hazardType);
                    }}
                    className="px-2.5 py-1 rounded-full bg-slate-950 border border-slate-700 hover:border-blue-500 hover:text-white text-[11px] text-slate-300 transition"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label htmlFor="district-select" className="block text-xs text-slate-400 mb-1 font-medium">
                  District (optional)
                </label>
                <select
                  id="district-select"
                  value={districtId}
                  onChange={(e) => setDistrictId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  {DISTRICTS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="hazard-select" className="block text-xs text-slate-400 mb-1 font-medium">
                  Hazard Type (optional)
                </label>
                <select
                  id="hazard-select"
                  value={hazardType}
                  onChange={(e) => setHazardType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">All hazard types</option>
                  {HAZARD_TYPES.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>
        </div>

        {/* Included Sections & Language Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Included Sections Card (Span 2) */}
          <Card className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <CardTitle>
                <span className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-400" /> Include in Report
                </span>
              </CardTitle>
              {isNoSectionSelected && (
                <span aria-live="polite" className="text-xs text-red-400 font-semibold mb-3">
                  Select at least one section
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SECTIONS.map((sec) => {
                const isChecked = includedSections.has(sec);
                const sectionLabels: Record<string, string> = {
                  ALERTS: "Alerts Issued",
                  REACH: "Citizens Reached",
                  REPORTS: "Ground Reports",
                  SHELTERS: "Shelter Occupancy",
                  SUPPLIES: "Relief Supplies",
                };
                return (
                  <label
                    key={sec}
                    onClick={() => toggleSection(sec)}
                    className={`p-2.5 rounded-lg border cursor-pointer transition flex items-start gap-2.5 select-none ${
                      isChecked
                        ? "bg-blue-950/50 border-blue-600/80 text-white"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      id={`chk-${sec}`}
                      checked={isChecked}
                      onChange={() => {}}
                      className="mt-0.5 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="text-xs font-semibold text-slate-200">
                        {sectionLabels[sec] || sec}
                      </div>
                      <div className="text-[10px] text-slate-400">Include {sec.toLowerCase()} data</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </Card>

          {/* Language Options Card */}
          <Card className="space-y-3">
            <CardTitle>
              <span className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-400" /> Language
              </span>
            </CardTitle>
            <div className="space-y-2">
              {LANGUAGES.map((lang) => (
                <label
                  key={lang}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer text-xs font-semibold transition ${
                    language === lang
                      ? "bg-blue-600 border-blue-500 text-white"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  <input
                    type="radio"
                    name="language-radio"
                    value={lang}
                    checked={language === lang}
                    onChange={() => setLanguage(lang)}
                    className="focus:ring-blue-500 text-blue-600"
                  />
                  <span>
                    {lang === "EN"
                      ? "English (EN)"
                      : lang === "SI"
                      ? "Sinhala (SI)"
                      : "Tamil (TA)"}
                  </span>
                </label>
              ))}
            </div>
          </Card>
        </div>

        {/* Active Filter Chips Row */}
        <Card className="flex flex-wrap items-center gap-2 text-xs py-3">
          <span className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider mr-1">
            Active Filters:
          </span>
          <span className="px-2.5 py-1 rounded-full bg-slate-950 text-slate-300 border border-slate-800 text-[11px]">
            {from} to {to}
          </span>
          {selectedDistrictObj && selectedDistrictObj.id !== "" && (
            <span className="px-2.5 py-1 rounded-full bg-blue-950 text-blue-300 border border-blue-800 text-[11px] flex items-center gap-1">
              District: {selectedDistrictObj.name}
              <button
                type="button"
                onClick={() => setDistrictId("")}
                aria-label="Remove district filter"
                className="hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {hazardType && (
            <span className="px-2.5 py-1 rounded-full bg-amber-950 text-amber-300 border border-amber-800 text-[11px] flex items-center gap-1">
              Hazard: {hazardType}
              <button
                type="button"
                onClick={() => setHazardType("")}
                aria-label="Remove hazard filter"
                className="hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          <span className="px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-[11px]">
            Lang: {language}
          </span>
          <span className="px-2.5 py-1 rounded-full bg-purple-950 text-purple-300 border border-purple-800 text-[11px]">
            {includedSections.size} Sections
          </span>
        </Card>

        {/* Action Row */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleReset}
            disabled={submitting}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-2 rounded-lg border border-slate-700 transition flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
          <button
            type="submit"
            disabled={!isValid || submitting}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-md shadow-blue-900/30 flex items-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Generating...
              </>
            ) : (
              <>
                Generate Report <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
