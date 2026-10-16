"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  History,
  FileBarChart,
  MapPin,
  ShieldAlert,
  ArrowRight,
  RotateCcw,
  FileText,
} from "lucide-react";
import {
  api,
  ApiError,
  AnalysisReport,
  DISTRICTS,
  formatDate,
} from "../_types";
import { Card, CardTitle, Banner, Loading, EmptyState } from "../_components";

export default function HistoryPage() {
  const [reports, setReports] = useState<AnalysisReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listReports();
      setReports(data);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(`Failed to load history (HTTP ${err.status}): ${err.message}`);
      } else {
        const msg = err instanceof Error ? err.message : "Failed to load history";
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  if (loading) {
    return <Loading message="Loading report history..." />;
  }

  return (
    <div className="space-y-6">
      {/* Top Title Card */}
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-sm font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-blue-400" /> Report History
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Log of post-event analysis reports generated for the Disaster Management Centre.
          </p>
        </div>

        <Link
          href="/resources/analysis"
          className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition flex items-center gap-1.5 shadow-md shadow-blue-900/30"
        >
          <FileBarChart className="w-4 h-4" /> Generate New Report
        </Link>
      </Card>

      {/* Banner Feedback */}
      {error && (
        <div className="space-y-4">
          <Banner type="error">
            <span>{error}</span>
          </Banner>
          <div className="flex justify-center">
            <button
              onClick={loadHistory}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-2 rounded-lg border border-slate-700 transition flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Retry Loading History
            </button>
          </div>
        </div>
      )}

      {/* History Table or Empty State */}
      {!error && reports.length === 0 ? (
        <EmptyState
          title="No Reports Yet"
          message="No post-event analysis reports have been generated yet."
          action={
            <Link
              href="/resources/analysis"
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition inline-flex items-center gap-1.5 shadow-md shadow-blue-900/30"
            >
              Generate First Report <ArrowRight className="w-4 h-4" />
            </Link>
          }
        />
      ) : (
        !error && (
          <Card className="space-y-3">
            <CardTitle>
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" /> Saved Reports ({reports.length})
              </span>
            </CardTitle>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 uppercase text-[10px] text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">REPORT ID</th>
                    <th className="py-2.5 px-3">PERIOD WINDOW</th>
                    <th className="py-2.5 px-3">GENERATED AT</th>
                    <th className="py-2.5 px-3">DISTRICT SCOPE</th>
                    <th className="py-2.5 px-3">HAZARD TYPE</th>
                    <th className="py-2.5 px-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {reports.map((rep) => {
                    const districtName =
                      DISTRICTS.find((d) => d.id === rep.filters.districtId)?.name ||
                      rep.filters.districtId ||
                      "All districts";
                    const hazardName = rep.filters.hazardType || "All hazard types";
                    const shortId = rep.id.length > 8 ? `${rep.id.slice(0, 8)}...` : rep.id;

                    const formatDateSimple = (isoStr: string) => {
                      try {
                        return new Date(isoStr).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        });
                      } catch {
                        return isoStr;
                      }
                    };

                    return (
                      <tr key={rep.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-3 font-mono font-semibold text-blue-400">
                          {shortId}
                        </td>
                        <td className="py-2.5 px-3 text-slate-200">
                          {formatDateSimple(rep.filters.from)} &mdash; {formatDateSimple(rep.filters.to)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                          {formatDate(rep.generatedAt)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-500" /> {districtName}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          <span className="flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3 text-amber-500" /> {hazardName}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Link
                            href={`/resources/analysis/${rep.id}`}
                            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition inline-flex items-center gap-1"
                          >
                            View <ArrowRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}
    </div>
  );
}
