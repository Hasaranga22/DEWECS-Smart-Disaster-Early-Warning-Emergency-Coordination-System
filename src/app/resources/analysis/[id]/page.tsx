"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  FileText,
  Megaphone,
  Users,
  CheckCircle2,
  Home,
  BarChart2,
  Share2,
  Calendar,
  MapPin,
  ShieldAlert,
  PackageCheck,
  RotateCcw,
  ArrowLeft,
  History,
  Check,
  Clock,
  XCircle,
} from "lucide-react";
import {
  api,
  ApiError,
  AnalysisReport,
  DISTRICTS,
  formatDate,
  formatNumber,
} from "../_types";
import {
  Card,
  CardTitle,
  KpiTile,
  Banner,
  Loading,
  EmptyState,
  StatusBadge,
} from "../_components";

export default function ReportSummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const reportId = resolvedParams.id;

  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getReport(reportId);
      setReport(data);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError({ status: err.status, message: err.message });
      } else {
        const msg = err instanceof Error ? err.message : "Failed to load report";
        setError({ status: 500, message: msg });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [reportId]);

  if (loading) {
    return <Loading message="Loading report summary..." />;
  }

  if (error) {
    if (error.status === 404) {
      return (
        <EmptyState
          title="Report Not Found"
          message={`No post-event report exists for ID "${reportId}".`}
          action={
            <Link
              href="/resources/analysis"
              className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-xs font-semibold transition inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Setup
            </Link>
          }
        />
      );
    }

    if (error.status === 403) {
      return (
        <EmptyState
          title="Access Denied"
          message="Viewing post-event analysis snapshots requires DMC_OFFICIAL role."
          action={
            <Link
              href="/resources/analysis/history"
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg px-4 py-2 text-xs font-semibold transition border border-slate-700 inline-flex items-center gap-1.5"
            >
              Back to History
            </Link>
          }
        />
      );
    }

    return (
      <div className="space-y-4">
        <Banner type="error">
          <span>Failed to load report snapshot (HTTP {error.status}): {error.message}</span>
        </Banner>
        <div className="flex justify-center">
          <button
            onClick={loadData}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-2 rounded-lg border border-slate-700 transition flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Retry Request
          </button>
        </div>
      </div>
    );
  }

  if (!report) return null;

  const { filters, metrics, warningFlag, generatedAt, sourceCutoff } = report;
  const verifiedCount = metrics.reports.verified;
  const rejectedCount = metrics.reports.rejected;
  const pendingCount = metrics.reports.pending;
  const totalReportsCount = verifiedCount + rejectedCount + pendingCount;

  const verifiedPct =
    totalReportsCount > 0 ? Math.round((verifiedCount / totalReportsCount) * 100) : 0;
  const pendingPct =
    totalReportsCount > 0 ? Math.round((pendingCount / totalReportsCount) * 100) : 0;
  const rejectedPct =
    totalReportsCount > 0 ? Math.round((rejectedCount / totalReportsCount) * 100) : 0;

  const districtName =
    DISTRICTS.find((d) => d.id === filters.districtId)?.name ||
    filters.districtId ||
    "All districts";

  const hazardName = filters.hazardType || "All hazard types";

  const isAllZeroMetrics =
    metrics.alerts.total === 0 &&
    metrics.reach.distinctCitizens === 0 &&
    totalReportsCount === 0 &&
    metrics.shelters.activated === 0 &&
    warningFlag;

  const periodRangeLabel = `${new Date(filters.from).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  })}`;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" /> Analysis Report &bull; {periodRangeLabel}
              </h1>
              <StatusBadge status="FINAL" text="v1.0 &bull; FINAL" />
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-3 flex-wrap">
              <span>Generated {formatDate(generatedAt)}</span>
              <span>&bull;</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-400" /> Period:{" "}
                <strong className="text-white">
                  {formatDate(filters.from)} &mdash; {formatDate(filters.to)}
                </strong>
              </span>
              <span>&bull;</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-blue-400" /> Scope:{" "}
                <strong className="text-slate-200">{districtName}</strong>
              </span>
              <span>&bull;</span>
              <span className="flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" /> Hazard:{" "}
                <strong className="text-slate-200">{hazardName}</strong>
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/resources/analysis/history"
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-2 rounded-lg border border-slate-700 transition flex items-center gap-1.5"
            >
              <History className="w-3.5 h-3.5" /> Back to History
            </Link>
            <Link
              href={`/resources/analysis/${reportId}/charts`}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-2 rounded-lg border border-slate-700 transition flex items-center gap-1.5"
            >
              <BarChart2 className="w-4 h-4 text-blue-400" /> View Charts
            </Link>
            <Link
              href={`/resources/analysis/${reportId}/share`}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition flex items-center gap-1.5 shadow-md shadow-blue-900/30"
            >
              <Share2 className="w-4 h-4" /> Export &amp; Share
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-3 border-t border-slate-800 gap-2">
          <div>
            Source Cutoff: <strong className="text-slate-300">{formatDate(sourceCutoff)}</strong>
          </div>
          <div>
            Language: <strong className="text-blue-400 font-mono">{filters.language}</strong>
          </div>
          <div>
            Report ID: <strong className="text-slate-400 font-mono">{report.id}</strong>
          </div>
        </div>
      </Card>

      {/* Warning Banner */}
      {warningFlag && (
        <Banner type="warn">
          No activity recorded for this period. Figures shown are zero.
        </Banner>
      )}

      {/* Empty State Banner if all zero */}
      {isAllZeroMetrics && (
        <EmptyState
          title="Zero Activity Recorded"
          message="No hazard warnings, citizen notifications, incident reports, or shelter events were logged within the selected time window."
          action={
            <Link
              href="/resources/analysis"
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition inline-flex items-center gap-1.5"
            >
              Back to Setup
            </Link>
          }
        />
      )}

      {/* 4 KPI Tiles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile
          label="Alerts Issued"
          value={metrics.alerts.total}
          subtext="Total emergency broadcasts"
          icon={<Megaphone className="w-4 h-4 text-blue-400" />}
        />

        <KpiTile
          label="Distinct Citizens Reached"
          value={formatNumber(metrics.reach.distinctCitizens)}
          subtext="Unique citizens with confirmed alert delivery"
          icon={<Users className="w-4 h-4 text-emerald-400" />}
        />

        <KpiTile
          label="Reports Verified"
          value={`${verifiedCount}/${totalReportsCount}`}
          subtext={`${verifiedCount} of ${totalReportsCount} verified (${verifiedPct}%)`}
          icon={<CheckCircle2 className="w-4 h-4 text-blue-400" />}
          progress={verifiedPct}
          progressColor="bg-blue-500"
        />

        <KpiTile
          label="Shelters Activated"
          value={metrics.shelters.activated}
          subtext={`Peak occupancy: ${formatNumber(metrics.shelters.peakOccupancy)} citizens`}
          icon={<Home className="w-4 h-4 text-amber-400" />}
        />
      </div>

      {/* Reach Breakdown Card */}
      <Card className="space-y-3">
        <CardTitle>
          <span className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" /> Citizen Notification Reach Breakdown
          </span>
        </CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 uppercase text-[10px] text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">CHANNEL</th>
                <th className="py-2.5 px-3 text-right">ATTEMPTED</th>
                <th className="py-2.5 px-3 text-right">DELIVERED</th>
                <th className="py-2.5 px-3 text-right">FAILED</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {(["PUSH", "SMS"] as const).map((ch) => {
                const stats = metrics.reach.perChannel[ch] || {
                  attempted: 0,
                  delivered: 0,
                  failed: 0,
                };
                return (
                  <tr key={ch} className="hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-3 font-semibold text-white font-sans">
                      {ch === "PUSH" ? "Mobile App Push" : "SMS Emergency Alert"}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-slate-300">
                      {formatNumber(stats.attempted)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-emerald-400">
                      {formatNumber(stats.delivered)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-red-400">
                      {formatNumber(stats.failed)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Reports Review Tally Card */}
      <Card className="space-y-4">
        <CardTitle>
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-400" /> Ground Reports Review Status
          </span>
        </CardTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" /> Verified Reports
              </span>
              <span className="font-mono text-white font-bold">{verifiedCount} of {totalReportsCount} ({verifiedPct}%)</span>
            </div>
            <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
              <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${verifiedPct}%` }} />
            </div>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Pending Review
              </span>
              <span className="font-mono text-white font-bold">{pendingCount} of {totalReportsCount} ({pendingPct}%)</span>
            </div>
            <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
              <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${pendingPct}%` }} />
            </div>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-red-400 font-semibold flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5" /> Rejected Reports
              </span>
              <span className="font-mono text-white font-bold">{rejectedCount} of {totalReportsCount} ({rejectedPct}%)</span>
            </div>
            <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
              <div className="h-full bg-red-500 transition-all duration-300" style={{ width: `${rejectedPct}%` }} />
            </div>
          </div>
        </div>
      </Card>

      {/* Relief Supplies Distribution Card */}
      <Card className="space-y-3">
        <CardTitle>
          <span className="flex items-center gap-2">
            <PackageCheck className="w-4 h-4 text-emerald-400" /> Relief Supply Distribution
          </span>
        </CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 uppercase text-[10px] text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">SUPPLY TYPE</th>
                <th className="py-2.5 px-3 text-right">DISTRIBUTED</th>
                <th className="py-2.5 px-3 text-right">TOTAL ALLOCATED</th>
                <th className="py-2.5 px-3 text-right">% FULFILLED</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {Object.keys(metrics.supplies.byType || {}).length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-3 text-center text-slate-500 text-xs font-sans">
                    No supply distribution records.
                  </td>
                </tr>
              ) : (
                Object.entries(metrics.supplies.byType).map(([type, item]) => {
                  const pctText =
                    item.percent !== null && item.percent !== undefined
                      ? `${item.percent}%`
                      : "n/a";
                  
                  const pctColor =
                    item.percent === null || item.percent === undefined
                      ? "text-slate-400"
                      : item.percent === 100
                      ? "text-emerald-400 font-bold"
                      : item.percent >= 50
                      ? "text-blue-400 font-semibold"
                      : "text-amber-400 font-semibold";

                  return (
                    <tr key={type} className="hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-3 font-semibold text-white font-sans">{type}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-slate-200">
                        {formatNumber(item.distributed)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-slate-400">
                        {formatNumber(item.total)}
                      </td>
                      <td className={`py-2.5 px-3 text-right tabular-nums ${pctColor}`}>
                        {pctText}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
