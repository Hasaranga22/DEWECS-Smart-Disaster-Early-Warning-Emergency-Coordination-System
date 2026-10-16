"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  ClipboardList,
  ImageIcon,
  Inbox,
  Plus,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import { CreativeDewecsLogo } from "@/components/CreativeDewecsLogo";
import { IdbOutboxRepository } from "@/modules/uc2-report/client/IdbOutboxRepository";
import type { LocalOutboxEntry } from "@/modules/uc2-report/domain/LocalOutboxEntry";
import { useNetworkStatus } from "@/modules/uc2-report/client/network";
import { hazardMeta, timeAgo } from "@/modules/uc2-report/client/reportUi";
import { syncPendingOutbox } from "@/modules/uc2-report/client/syncOutbox";

type Notice = { message: string; type: "info" | "success" | "error" };

const STATUS_STYLE: Record<string, string> = {
  PENDING_SYNC: "bg-amber-50 text-amber-800",
  SYNCING: "bg-sky-50 text-sky-800",
  FAILED: "bg-rose-50 text-rose-700",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_SYNC: "Waiting to send",
  SYNCING: "Sending",
  FAILED: "Failed",
};

function countPhotos(photo?: string | null): number {
  if (!photo) return 0;
  try {
    const parsed: unknown = JSON.parse(photo);
    return Array.isArray(parsed) ? parsed.length : 1;
  } catch {
    return 1;
  }
}

export default function OutboxPage() {
  const { isOnline, simulateOffline, setSimulateOffline } = useNetworkStatus();
  const [entries, setEntries] = useState<LocalOutboxEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const syncingRef = useRef(false);

  const loadOutbox = useCallback(async () => {
    try {
      const repo = new IdbOutboxRepository();
      const items = await repo.getAll();
      setEntries([...items].sort(
        (a, b) => new Date(b.captureTime).getTime() - new Date(a.captureTime).getTime()
      ));
      setLoadError("");
      return items;
    } catch {
      setLoadError("Could not read reports saved on this device.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const syncReports = useCallback(async () => {
    // A ref blocks overlapping automatic and manual sync attempts immediately.
    if (syncingRef.current || !isOnline) return;
    syncingRef.current = true;
    setIsSyncing(true);
    setNotice({ message: "Sending saved reports…", type: "info" });

    let sent = 0;
    let failed = 0;
    try {
      const summary = await syncPendingOutbox();
      sent = summary.sent;
      failed = summary.failed;

      if (failed) {
        setNotice({
          message: `${sent} sent, ${failed} failed. You can try again.`,
          type: "error",
        });
      } else if (sent) {
        setNotice({
          message: `${sent} report${sent === 1 ? "" : "s"} sent successfully.`,
          type: "success",
        });
      } else {
        setNotice(null);
      }
    } catch {
      setNotice({ message: "Unable to access the outbox. Please retry.", type: "error" });
    } finally {
      await loadOutbox();
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [isOnline, loadOutbox]);

  useEffect(() => {
    void loadOutbox();
  }, [loadOutbox]);

  useEffect(() => {
    const refreshAfterSync = () => void loadOutbox();
    window.addEventListener("dewecs:outbox-synced", refreshAfterSync);
    return () => window.removeEventListener("dewecs:outbox-synced", refreshAfterSync);
  }, [loadOutbox]);

  const failedCount = entries.filter((entry) => entry.status === "FAILED").length;
  const waitingCount = entries.filter((entry) => entry.status === "PENDING_SYNC").length;
  const canSend = isOnline && !isSyncing && entries.length > 0 && !loading && !loadError;

  return (
    <div className="min-h-screen bg-slate-50 pb-28 text-slate-900">
      <header className="bg-slate-950 text-white">
        <div className="mx-auto max-w-xl px-4 pb-5 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Link
                href="/report/new"
                aria-label="Back to report a hazard"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
              >
                <ChevronLeft size={20} />
              </Link>
              <CreativeDewecsLogo variant="dark" size="sm" showTagline={false} />
            </div>
            <Link
              href="/report/new"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-teal-400 px-3 py-2.5 text-sm font-semibold text-slate-950 hover:bg-teal-300"
            >
              <Plus size={16} /> New report
            </Link>
          </div>
          <div className="mt-5">
            <h1 className="text-2xl font-bold tracking-tight">Outbox</h1>
            <p className="mt-1 text-sm text-slate-300">
              Reports saved on this device until they are sent.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-4 px-4 py-5">
        <nav aria-label="Report navigation" className="grid grid-cols-2 gap-2">
          <Link href="/report/alerts" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-100">
            <AlertTriangle size={16} className="text-amber-600" /> Active alerts
          </Link>
          <Link href="/report/history" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-100">
            <ClipboardList size={16} className="text-teal-700" /> Sent reports
          </Link>
        </nav>

        <section className={`rounded-2xl border p-4 ${isOnline ? "border-slate-200 bg-white" : "border-amber-200 bg-amber-50"}`} aria-label="Network status">
          <div className="flex items-center gap-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isOnline ? "bg-emerald-50 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
              {isOnline ? <Wifi size={20} /> : <WifiOff size={20} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{isOnline ? "Connection available" : "Offline mode"}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                {isOnline ? "Waiting reports can be sent now." : "Your unsent reports remain saved on this device."}
              </p>
            </div>
          </div>
          {process.env.NODE_ENV === "development" && (
            <button type="button" onClick={() => setSimulateOffline(!simulateOffline)} className="mt-3 text-xs font-medium text-teal-800 underline underline-offset-2">
              {simulateOffline ? "Disable simulated offline mode" : "Simulate offline mode (dev only)"}
            </button>
          )}
        </section>

        {notice && (
          <div role={notice.type === "error" ? "alert" : "status"} className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${notice.type === "error" ? "bg-rose-50 text-rose-800" : notice.type === "success" ? "bg-emerald-50 text-emerald-800" : "bg-sky-50 text-sky-800"}`}>
            {notice.type === "error" ? <AlertCircle size={18} className="mt-0.5 shrink-0" /> : notice.type === "success" ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> : <RefreshCw size={18} className="mt-0.5 shrink-0 animate-spin" />}
            <span>{notice.message}</span>
          </div>
        )}

        {loading ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center" role="status">
            <RefreshCw size={24} className="mx-auto mb-3 animate-spin text-teal-700" />
            <p className="text-sm text-slate-600">Loading saved reports…</p>
          </section>
        ) : loadError ? (
          <section role="alert" className="rounded-2xl border border-rose-200 bg-white p-7 text-center">
            <AlertCircle size={28} className="mx-auto mb-3 text-rose-600" />
            <h2 className="font-semibold">Unable to open outbox</h2>
            <p className="mt-1 text-sm text-slate-600">{loadError}</p>
            <button type="button" onClick={() => void loadOutbox()} className="mt-4 min-h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white">Try again</button>
          </section>
        ) : entries.length === 0 ? (
          <section className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700"><Inbox size={28} /></span>
            <h2 className="mt-4 text-lg font-semibold">No reports waiting</h2>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-600">Reports you save while offline will appear here until sent.</p>
            <Link href="/report/new" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white">Report a hazard</Link>
          </section>
        ) : (
          <section aria-labelledby="queued-heading">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 id="queued-heading" className="text-base font-semibold">Saved reports</h2>
                <p className="mt-0.5 text-xs text-slate-500">{waitingCount} waiting{failedCount ? ` · ${failedCount} failed` : ""}</p>
              </div>
              <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">{entries.length} total</span>
            </div>
            <ul className="space-y-3">
              {entries.map((entry) => {
                const hazard = hazardMeta(entry.hazardType);
                const photos = countPhotos((entry as LocalOutboxEntry & { photo?: string }).photo);
                return (
                  <li key={entry.localId} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start gap-3">
                      <span aria-hidden="true" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl ${hazard.tint}`}>{hazard.icon}</span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-semibold">{hazard.label}</h3>
                        <span className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[entry.status] ?? STATUS_STYLE.FAILED}`}>
                          {entry.status === "FAILED" ? <AlertCircle size={13} /> : entry.status === "SYNCING" ? <RefreshCw size={13} className="animate-spin" /> : <Clock3 size={13} />}
                          {STATUS_LABEL[entry.status] ?? "Needs attention"}
                        </span>
                      </div>
                    </div>
                    {entry.description && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600">{entry.description}</p>}
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1"><Clock3 size={13} /> {timeAgo(entry.captureTime)}</span>
                      {photos > 0 && <span className="inline-flex items-center gap-1"><ImageIcon size={13} /> {photos} photo{photos === 1 ? "" : "s"}</span>}
                    </div>
                    {entry.failureReason && (
                      <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs leading-relaxed text-rose-800">{entry.failureReason}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>

      {!loading && !loadError && entries.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-sm pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto max-w-xl">
            <button type="button" onClick={() => void syncReports()} disabled={!canSend} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500">
              <RefreshCw size={17} className={isSyncing ? "animate-spin" : ""} />
              {isSyncing ? "Sending reports…" : isOnline ? "Send saved reports" : "Reconnect to send"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
