"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  Share2,
  Download,
  ArrowLeft,
  FileText,
  Building2,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Lock,
} from "lucide-react";
import {
  api,
  ApiError,
  AnalysisReport,
  ShareOutcome,
  PARTNER_ORGS,
  LANGUAGES,
  formatDate,
} from "../../_types";
import { Card, CardTitle, Banner, Loading, StatusBadge } from "../../_components";

export default function ExportAndSharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const reportId = resolvedParams.id;

  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Export options
  const [exportFormat, setExportFormat] = useState<"PDF" | "CSV">("PDF");
  const [exportLang, setExportLang] = useState<"EN" | "SI" | "TA">("EN");
  const [privacyMasking, setPrivacyMasking] = useState<boolean>(false);

  // Sharing state
  const [selectedOrgs, setSelectedOrgs] = useState<Set<string>>(new Set());
  const [sharing, setSharing] = useState<boolean>(false);
  const [outcomes, setOutcomes] = useState<ShareOutcome[] | null>(null);
  const [banner, setBanner] = useState<{
    type: "success" | "error" | "warn" | "info";
    message: string;
  } | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getReport(reportId);
      setReport(data);
      setExportLang(data.filters.language);
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

  const toggleOrg = (orgId: string) => {
    const next = new Set(selectedOrgs);
    if (next.has(orgId)) {
      next.delete(orgId);
    } else {
      next.add(orgId);
    }
    setSelectedOrgs(next);
  };

  const handleDownloadPdf = () => {
    if (typeof window !== "undefined") {
      window.open(`/api/analysis/${reportId}/pdf`, "_blank");
    }
  };

  const handleShare = async (targetOrgIds?: string[]) => {
    const orgsToShare = targetOrgIds ?? Array.from(selectedOrgs);
    if (orgsToShare.length === 0 || sharing) return;

    setSharing(true);
    setBanner(null);

    try {
      const res = await api.shareReport(reportId, orgsToShare);
      
      // Merge new outcomes into existing ones or set outcomes
      if (outcomes) {
        const existingMap = new Map(outcomes.map((o) => [o.organizationId, o]));
        res.outcomes.forEach((o) => existingMap.set(o.organizationId, o));
        setOutcomes(Array.from(existingMap.values()));
      } else {
        setOutcomes(res.outcomes);
      }

      const failedCount = res.outcomes.filter((o) => o.status === "FAILED").length;
      if (failedCount > 0) {
        setBanner({
          type: "warn",
          message: `${failedCount} recipient unreachable. You can retry dispatching below.`,
        });
      } else {
        setBanner({
          type: "success",
          message: `Successfully shared report with ${res.outcomes.length} partner organization(s).`,
        });
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setBanner({
          type: "error",
          message: `Share error (${err.status}): ${err.message}`,
        });
      } else {
        const msg = err instanceof Error ? err.message : "Network error";
        setBanner({
          type: "error",
          message: `Failed to share report: ${msg}`,
        });
      }
    } finally {
      setSharing(false);
    }
  };

  if (loading) {
    return <Loading message="Loading export and share options..." />;
  }

  if (error || !report) {
    return (
      <div className="space-y-4">
        <Banner type="error">
          <span>{error || "Report unavailable."}</span>
        </Banner>
        <div className="flex justify-center">
          <Link
            href="/resources/analysis/history"
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-2 rounded-lg border border-slate-700 inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to History
          </Link>
        </div>
      </div>
    );
  }

  const failedOutcomesCount =
    outcomes?.filter((o) => o.status === "FAILED").length ?? 0;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href={`/resources/analysis/${reportId}`}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 p-2 rounded-lg transition border border-slate-700 flex items-center justify-center"
              aria-label="Back to Summary"
            >
              <ArrowLeft className="w-4 h-4 text-slate-300" />
            </Link>
            <h1 className="text-sm font-bold text-white flex items-center gap-2">
              <Share2 className="w-5 h-5 text-blue-400" /> Export &amp; Partner Share
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Export the official PDF report or share directly with partner response agencies.
          </p>
        </div>

        <Link
          href={`/resources/analysis/${reportId}`}
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-2 rounded-lg border border-slate-700 inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Summary
        </Link>
      </Card>

      {/* Banner Feedback */}
      {banner && (
        <Banner type={banner.type} onClose={() => setBanner(null)}>
          {banner.message}
        </Banner>
      )}

      {/* Grid: Export Document Card + Partner Share Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Export Document Card */}
        <Card className="space-y-4">
          <CardTitle>
            <span className="flex items-center gap-2">
              <Download className="w-4 h-4 text-blue-400" /> Export Document
            </span>
          </CardTitle>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-medium">
                Export Format
              </label>
              <div className="flex gap-3">
                <label
                  className={`flex-1 p-2.5 rounded-lg border cursor-pointer text-xs font-semibold flex items-center justify-center gap-2 transition ${
                    exportFormat === "PDF"
                      ? "bg-blue-600 border-blue-500 text-white"
                      : "bg-slate-950 border-slate-800 text-slate-400"
                  }`}
                >
                  <input
                    type="radio"
                    name="fmt"
                    value="PDF"
                    checked={exportFormat === "PDF"}
                    onChange={() => setExportFormat("PDF")}
                    className="hidden"
                  />
                  <FileText className="w-3.5 h-3.5" /> PDF Document
                </label>
                <label
                  className={`flex-1 p-2.5 rounded-lg border cursor-not-allowed text-xs font-semibold flex items-center justify-center gap-2 opacity-50 ${
                    exportFormat === "CSV"
                      ? "bg-blue-600 border-blue-500 text-white"
                      : "bg-slate-950 border-slate-800 text-slate-500"
                  }`}
                >
                  <input
                    type="radio"
                    name="fmt"
                    value="CSV"
                    disabled
                    checked={exportFormat === "CSV"}
                    onChange={() => setExportFormat("CSV")}
                    className="hidden"
                  />
                  Raw CSV (Disabled)
                </label>
              </div>
            </div>

            <div>
              <label htmlFor="export-lang-select" className="block text-xs text-slate-400 mb-1 font-medium">
                Target Language
              </label>
              <select
                id="export-lang-select"
                value={exportLang}
                onChange={(e) => setExportLang(e.target.value as "EN" | "SI" | "TA")}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {l === "EN" ? "English (EN)" : l === "SI" ? "Sinhala (SI)" : "Tamil (TA)"}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-1">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={privacyMasking}
                  onChange={(e) => setPrivacyMasking(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500"
                />
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" /> Apply privacy masking for external recipients
                </span>
              </label>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition shadow-md shadow-blue-900/30 flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" /> Download PDF Report
              </button>
            </div>
          </div>
        </Card>

        {/* Partner Share Card */}
        <Card className="space-y-4">
          <CardTitle>
            <span className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-400" /> Select Partner Organisations
            </span>
          </CardTitle>

          <p className="text-xs text-slate-400">
            Select response partner organisations to share this analysis report.
          </p>

          <div className="space-y-2">
            {PARTNER_ORGS.map((org) => {
              const isChecked = selectedOrgs.has(org.id);
              return (
                <label
                  key={org.id}
                  onClick={() => toggleOrg(org.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition flex items-center justify-between select-none ${
                    isChecked
                      ? "bg-blue-950/40 border-blue-600/80 text-white"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id={`org-${org.id}`}
                      checked={isChecked}
                      onChange={() => {}}
                      className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="text-xs font-semibold text-slate-200">{org.name}</div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-slate-300 border border-slate-800">
                    {org.type}
                  </span>
                </label>
              );
            })}
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => handleShare()}
              disabled={selectedOrgs.size === 0 || sharing}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition shadow-md shadow-blue-900/30 flex items-center justify-center gap-2"
            >
              {sharing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Sharing Report...
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" /> Share Report ({selectedOrgs.size})
                </>
              )}
            </button>
          </div>
        </Card>
      </div>

      {/* Per-Recipient Share Results Table */}
      {outcomes && outcomes.length > 0 && (
        <Card className="space-y-4">
          <CardTitle>
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Share Results
            </span>
          </CardTitle>

          {failedOutcomesCount > 0 && (
            <Banner type="warn">
              {failedOutcomesCount} recipient unreachable. You can click Retry next to the failed organisation.
            </Banner>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 uppercase text-[10px] text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">ORGANISATION</th>
                  <th className="py-2.5 px-3">STATUS</th>
                  <th className="py-2.5 px-3">ATTEMPTED AT</th>
                  <th className="py-2.5 px-3">FAILURE REASON</th>
                  <th className="py-2.5 px-3 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {outcomes.map((out) => {
                  const isSent = out.status === "SENT";
                  const orgName =
                    out.organizationName && out.organizationName !== "?"
                      ? out.organizationName
                      : PARTNER_ORGS.find((p) => p.id === out.organizationId)?.name || out.organizationId;
                  return (
                    <tr key={out.organizationId} className="hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-3 font-semibold text-white">
                        {orgName}
                      </td>
                      <td className="py-2.5 px-3">
                        <StatusBadge status={out.status} />
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                        {formatDate(out.attemptedAt)}
                      </td>
                      <td className="py-2.5 px-3 text-[11px]">
                        {out.failureReason ? (
                          <span className="text-red-400 font-medium">{out.failureReason}</span>
                        ) : (
                          <span className="text-slate-500 font-mono">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {isSent ? (
                          <span className="text-slate-500 font-mono text-[11px]">—</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleShare([out.organizationId])}
                            disabled={sharing}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-1 border border-slate-700 rounded-lg transition inline-flex items-center gap-1.5"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-amber-400" /> Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
