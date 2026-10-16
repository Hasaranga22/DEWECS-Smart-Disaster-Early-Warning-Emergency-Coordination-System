import { IdbOutboxRepository } from "./IdbOutboxRepository";

export interface OutboxSyncSummary {
  attempted: number;
  sent: number;
  failed: number;
}

let activeSync: Promise<OutboxSyncSummary> | null = null;

async function runSync(): Promise<OutboxSyncSummary> {
  const repo = new IdbOutboxRepository();
  const pending = await repo.getPending();
  let sent = 0;
  let failed = 0;

  for (const entry of pending) {
    try {
      await repo.save({ ...entry, status: "SYNCING", failureReason: undefined });
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });

      if (!response.ok) {
        const body: { error?: string; message?: string } | null = await response
          .json()
          .catch(() => null);
        throw new Error(body?.error ?? body?.message ?? "The server did not accept this report.");
      }

      await repo.remove(entry.localId);
      sent += 1;
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : "Could not send report.";
      await repo.save({ ...entry, status: "FAILED", failureReason: reason });
      failed += 1;
    }
  }

  const summary = { attempted: pending.length, sent, failed };
  window.dispatchEvent(new CustomEvent("dewecs:outbox-synced", { detail: summary }));
  return summary;
}

/** Shares one in-flight sync across reconnect and manual-send triggers. */
export function syncPendingOutbox(): Promise<OutboxSyncSummary> {
  if (activeSync) return activeSync;

  activeSync = runSync().finally(() => {
    activeSync = null;
  });
  return activeSync;
}
