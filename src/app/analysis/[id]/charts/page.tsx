"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  BarChart2,
  ArrowLeft,
  Megaphone,
  CheckCircle2,
  PackageCheck,
  RotateCcw,
} from "lucide-react";
import { api, ApiError, AnalysisReport, formatNumber } from "../../_types";
import { Card, CardTitle, Banner, Loading } from "../../_components";

const SEVERITY_COLORS: Record<string, string> = {
  ADVISORY: "bg-slate-500",
  WATCH: "bg-amber-500",
  WARNING: "bg-orange-500",
  EMERGENCY: "bg-red-500",
};

export default function ChartsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const reportId = resolvedParams.id;

  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getReport(reportId);
      setReport(data);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(`Failed to load report (HTTP ${err.status}): ${err.message}`);
      } else {
        const msg = err instanceof Error ? err.message : "Failed to load report";
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [reportId]);

  if (loading) {
    return <Loading message="Loading visual breakdown charts..." />;
  }

  if (error || !report) {
    return (
      <div className="space-y-4">
        <Banner type="error">
          <span>{error || "Report not found."}</span>
        </Banner>
        <div className="flex justify-center gap-3">
          <button
            onClick={loadData}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-2 rounded-lg border border-slate-700 transition flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Retry
          </button>
          <Link
            href="/analysis/history"
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition inline-flex items-center gap-1.5"
          >
            Back to History
          </Link>
        </div>
      </div>
    );
  }

  const { metrics, warningFlag } = report;

  // 1. Alert severity data
  const severityEntries = Object.entries(metrics.alerts.bySeverity || {});
  const maxSeverityCount = Math.max(...severityEntries.map(([, c]) => c), 1);

  // 2. Report decisions data
  const verified = metrics.reports.verified;
  const pending = metrics.reports.pending;
  const rejected = metrics.reports.rejected;
  const totalReports = verified + pending + rejected;

  const verifiedPct = totalReports > 0 ? Math.round((verified / totalReports) * 100) : 0;
  const pendingPct = totalReports > 0 ? Math.round((pending / totalReports) * 100) : 0;
  const rejectedPct = totalReports > 0 ? Math.round((rejected / totalReports) * 100) : 0;

  // 3. Supply distribution data
  const supplyEntries = Object.entries(metrics.supplies.byType || {});

  const isAllMetricsZero =
    metrics.alerts.total === 0 &&
    totalReports === 0 &&
    supplyEntries.every(([, v]) => v.distributed === 0);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href={`/analysis/${reportId}`}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 p-2 rounded-lg transition border border-slate-700 flex items-center justify-center"
              aria-label="Back to Summary KPIs"
            >
              <ArrowLeft className="w-4 h-4 text-slate-300" />
            </Link>
            <h1 className="text-sm font-bold text-white flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-blue-400" /> Visual Breakdown Charts
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Visual breakdown of alert severity, ground report review outcomes, and relief supply fulfillment.
          </p>
        </div>

        <Link
          href={`/analysis/${reportId}`}
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-2 rounded-lg border border-slate-700 transition inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Summary
        </Link>
      </Card>

      {/* Warning Banner if empty or zero */}
      {(isAllMetricsZero || warningFlag) && (
        <Banner type="warn">
          No activity recorded &mdash; charts unavailable.
        </Banner>
      )}

      {/* Chart Block 1: Alert Severity Distribution */}
      <Card className="space-y-4">
        <CardTitle>
          <span className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-blue-400" /> Alert Severity Distribution
          </span>
        </CardTitle>

        {severityEntries.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-4 text-center">
            No alert severity data recorded.
          </p>
        ) : (
          <div className="space-y-3 pt-1">
            {severityEntries.map(([sev, count]) => {
              const widthPct = Math.round((count / maxSeverityCount) * 100);
              const barColor = SEVERITY_COLORS[sev] || "bg-blue-500";
              return (
                <div key={sev} className="space-y-1 text-xs">
                  <div className="flex justify-between items-center text-slate-300 font-medium">
                    <span>{sev}</span>
                    <span className="font-mono tabular-nums text-slate-200">{count}</span>
                  </div>
                  <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className={`h-full ${barColor} transition-all duration-300`}
                      style={{ width: `${Math.max(widthPct, 2)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Chart Block 2: Ground Report Decisions */}
      <Card className="space-y-4">
        <CardTitle>
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Ground Report Decisions
          </span>
        </CardTitle>

        {totalReports === 0 ? (
          <p className="text-xs text-slate-500 italic py-4 text-center">
            No ground reports submitted in this period.
          </p>
        ) : (
          <div className="space-y-4 pt-1">
            {/* Verified Row */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between items-center text-slate-300 font-medium">
                <span className="text-emerald-400 font-semibold">Verified</span>
                <span className="font-mono tabular-nums text-slate-200">
                  {verified} of {totalReports} = {verifiedPct}%
                </span>
              </div>
              <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${Math.max(verifiedPct, 1)}%` }}
                />
              </div>
            </div>

            {/* Pending Row */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between items-center text-slate-300 font-medium">
                <span className="text-amber-400 font-semibold">Pending</span>
                <span className="font-mono tabular-nums text-slate-200">
                  {pending} of {totalReports} = {pendingPct}%
                </span>
              </div>
              <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-amber-500 transition-all duration-300"
                  style={{ width: `${Math.max(pendingPct, 1)}%` }}
                />
              </div>
            </div>

            {/* Rejected Row */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between items-center text-slate-300 font-medium">
                <span className="text-red-400 font-semibold">Rejected</span>
                <span className="font-mono tabular-nums text-slate-200">
                  {rejected} of {totalReports} = {rejectedPct}%
                </span>
              </div>
              <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-red-500 transition-all duration-300"
                  style={{ width: `${Math.max(rejectedPct, 1)}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Chart Block 3: Relief Supply Distribution */}
      <Card className="space-y-4">
        <CardTitle>
          <span className="flex items-center gap-2">
            <PackageCheck className="w-4 h-4 text-purple-400" /> Relief Supply Distribution
          </span>
        </CardTitle>

        {supplyEntries.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-4 text-center">
            No supply distribution data.
          </p>
        ) : (
          <div className="space-y-4 pt-1">
            {supplyEntries.map(([type, item]) => {
              const fillPct = item.percent !== null && item.percent !== undefined ? item.percent : 0;
              const pctText =
                item.percent !== null && item.percent !== undefined
                  ? `${item.percent}%`
                  : "n/a";
              return (
                <div key={type} className="space-y-1 text-xs">
                  <div className="flex justify-between items-center text-slate-300 font-medium">
                    <span className="font-semibold text-white">{type}</span>
                    <span className="font-mono tabular-nums text-slate-200">
                      {formatNumber(item.distributed)} of {formatNumber(item.total)} = {pctText}
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-purple-500 transition-all duration-300"
                      style={{ width: `${Math.min(Math.max(fillPct, 1), 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
