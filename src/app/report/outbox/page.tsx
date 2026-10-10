"use client";

import React, { useEffect, useState } from "react";
import { IdbOutboxRepository } from "@/modules/uc2-report/client/IdbOutboxRepository";
import { LocalOutboxEntry } from "@/modules/uc2-report/domain/LocalOutboxEntry";
import { useNetworkStatus } from "@/modules/uc2-report/client/network";
import Link from "next/link";
import { WifiOff, Wifi, RefreshCw, AlertCircle, Clock, CheckCircle2, Plus, ImageIcon, Inbox, ClipboardList } from "lucide-react";

const HAZARD_META: Record<string, { icon: string; bg: string }> = {
  FLOOD: { icon: "🌊", bg: "bg-sky-50" },
  LANDSLIDE: { icon: "⛰️", bg: "bg-amber-50" },
  CYCLONE: { icon: "🌀", bg: "bg-teal-50" },
  DROUGHT: { icon: "☀️", bg: "bg-orange-50" },
  OTHER: { icon: "⚠️", bg: "bg-slate-100" },
};

const timeAgo = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} hr ago`;
  return new Date(iso).toLocaleDateString();
};

const photoCount = (photo?: string) => {
  if (!photo) return 0;
  try { const p = JSON.parse(photo); return Array.isArray(p) ? p.length : 1; } catch { return 1; }
};

export default function OutboxPage() {
  const { isOnline, simulateOffline, setSimulateOffline } = useNetworkStatus();
  const [entries, setEntries] = useState<LocalOutboxEntry[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ msg: string; type: "success" | "error" | "info" } | null>(null);

  useEffect(() => { loadOutbox(); }, []);

  useEffect(() => {
    if (isOnline && entries.some((e) => e.status === "PENDING_SYNC" || e.status === "FAILED")) {
      handleSync();
    }
  }, [isOnline]);

  const loadOutbox = async () => {
    const repo = new IdbOutboxRepository();
    const data = await repo.getAll();
    setEntries(data.sort((a, b) => new Date(b.captureTime).getTime() - new Date(a.captureTime).getTime()));
  };

  const handleSync = async () => {
    if (!isOnline) {
      setSyncResult({ msg: "You're offline. Reconnect to send your reports.", type: "error" });
      return;
    }
    setIsSyncing(true);
    setSyncResult({ msg: "Sending your reports…", type: "info" });
    let succeeded = 0;
    let failed = 0;

    const repo = new IdbOutboxRepository();
    const pending = await repo.getPending();

    for (const entry of pending) {
      try {
        const response = await fetch("/api/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry),
        });
        if (response.ok) {
          await repo.remove(entry.localId);
          succeeded++;
        } else {
          await repo.save({ ...entry, status: "FAILED", failureReason: "Server rejected" });
          failed++;
        }
      } catch (err: any) {
        await repo.save({ ...entry, status: "FAILED", failureReason: err.message });
        failed++;
      }
    }

    if (failed > 0) {
      setSyncResult({ msg: `${succeeded} sent, ${failed} failed. Tap Send all to retry.`, type: "error" });
    } else if (succeeded > 0) {
      setSyncResult({ msg: `${succeeded} report${succeeded === 1 ? "" : "s"} sent.`, type: "success" });
      setTimeout(() => setSyncResult(null), 3000);
    } else {
      setSyncResult(null);
    }
    setIsSyncing(false);
    await loadOutbox();
  };

  const statusStyle = (s: string) =>
    s === "PENDING_SYNC" ? "bg-amber-50 text-amber-700"
    : s === "SYNCING" ? "bg-sky-50 text-sky-700"
    : "bg-red-50 text-red-700";

  const statusLabel = (s: string) => (s === "PENDING_SYNC" ? "Waiting" : s === "SYNCING" ? "Sending" : "Failed");

  const failedCount = entries.filter((e) => e.status === "FAILED").length;

  return (
    <div className="min-h-screen bg-slate-100 pb-32">
      {/* Hero header */}
      <header className="bg-slate-950 text-white px-5 pt-5 pb-16 rounded-b-[2rem]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Outbox</h1>
            <p className="text-sm text-slate-400 mt-1">
              {entries.length === 0 ? "Nothing waiting to send" : `${entries.length} report${entries.length === 1 ? "" : "s"} waiting`}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Link href="/report/history" className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 px-3 py-2.5 rounded-xl active:bg-white/10"><ClipboardList size={16} /> Sent reports</Link>
            <Link href="/report/new" className="flex items-center gap-1.5 text-sm font-semibold bg-teal-500 text-slate-950 pl-3 pr-4 py-2.5 rounded-full active:bg-teal-400 shadow-lg">
              <Plus size={18} strokeWidth={3} /> New report
            </Link>
          </div>
        </div>
      </header>

      <main className="px-4 -mt-9 max-w-md mx-auto space-y-4">
        {/* Connection card */}
        <div className={`p-4 rounded-3xl flex items-center justify-between shadow-sm ${isOnline ? "bg-white" : "bg-amber-50 border border-amber-200"}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 ${isOnline ? "bg-emerald-50 text-emerald-600" : "bg-amber-100 text-amber-700"}`}>
              {isOnline ? <Wifi size={22} /> : <WifiOff size={22} />}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">{isOnline ? "You're online" : "You're offline"}</p>
              <p className="text-xs text-slate-500">{isOnline ? "Reports send automatically" : "Reports are saved on this phone"}</p>
            </div>
          </div>
          <button
            onClick={() => setSimulateOffline(!simulateOffline)}
            className="text-xs font-semibold px-3.5 py-2 bg-slate-100 text-slate-700 rounded-xl active:bg-slate-200 shrink-0"
          >
            {simulateOffline ? "Go online" : "Go offline"}
          </button>
        </div>

        {syncResult && (
          <div role="status" className={`px-4 py-3 flex items-center gap-2.5 rounded-2xl text-sm font-medium ${
            syncResult.type === "error" ? "bg-red-50 text-red-700" : syncResult.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-700"
          }`}>
            {syncResult.type === "info" && <RefreshCw size={16} className="animate-spin shrink-0" />}
            {syncResult.type === "error" && <AlertCircle size={16} className="shrink-0" />}
            {syncResult.type === "success" && <CheckCircle2 size={16} className="shrink-0" />}
            {syncResult.msg}
          </div>
        )}

        {entries.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 flex flex-col items-center text-center shadow-sm">
            <div className="h-20 w-20 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mb-4">
              <Inbox size={36} />
            </div>
            <p className="font-bold text-slate-900 text-lg">Everything is sent</p>
            <p className="text-slate-500 text-sm mt-1 max-w-[16rem]">Reports saved while offline will show up here until they're delivered.</p>
            <Link href="/report/new" className="mt-6 px-6 py-3 rounded-2xl bg-slate-900 text-white text-sm font-semibold active:scale-95 transition-transform">
              Report a hazard
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-1">
              <h2 className="font-bold text-slate-900">Waiting to send</h2>
              {failedCount > 0 && <span className="text-xs font-semibold text-red-600">{failedCount} failed</span>}
            </div>

            <ul className="space-y-3">
              {entries.map((entry) => {
                const meta = HAZARD_META[entry.hazardType] ?? HAZARD_META.OTHER;
                const photos = photoCount((entry as any).photo);
                return (
                  <li key={entry.localId} className="bg-white p-4 rounded-3xl shadow-sm flex gap-3.5">
                    <div className={`h-14 w-14 rounded-2xl ${meta.bg} flex items-center justify-center text-3xl shrink-0`}>
                      {meta.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-slate-900 capitalize truncate">{entry.hazardType.toLowerCase()}</h3>
                        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0 ${statusStyle(entry.status)}`}>
                          {entry.status === "PENDING_SYNC" && <Clock size={11} />}
                          {entry.status === "SYNCING" && <RefreshCw size={11} className="animate-spin" />}
                          {entry.status === "FAILED" && <AlertCircle size={11} />}
                          {statusLabel(entry.status)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mt-1 line-clamp-2">{entry.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                        <span>{timeAgo(entry.captureTime)}</span>
                        {photos > 0 && (
                          <span className="flex items-center gap-1"><ImageIcon size={12} /> {photos} photo{photos === 1 ? "" : "s"}</span>
                        )}
                      </div>
                      {entry.failureReason && (
                        <p className="text-xs text-red-600 mt-2 font-medium flex items-center gap-1">
                          <AlertCircle size={12} /> {entry.failureReason}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </main>

      {entries.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-slate-200 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            onClick={handleSync}
            disabled={isSyncing || !isOnline}
            className="w-full max-w-md mx-auto flex items-center justify-center gap-2 bg-teal-600 text-white font-semibold py-4 rounded-2xl shadow-lg active:scale-[0.98] transition-transform disabled:opacity-40 disabled:active:scale-100"
          >
            <RefreshCw size={20} className={isSyncing ? "animate-spin" : ""} />
            {isSyncing ? "Sending…" : isOnline ? "Send all now" : "Reconnect to send"}
          </button>
        </div>
      )}
    </div>
  );
}
