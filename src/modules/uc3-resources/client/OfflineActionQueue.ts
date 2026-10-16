export type ActionStatus = "PENDING" | "CONFIRMED" | "CONFLICT" | "FAILED";

export interface QueuedAction {
  actionId: string;
  type: "UPDATE_OCCUPANCY" | "DISPATCH_TEAM" | "DISTRIBUTE_SUPPLY";
  payload: Record<string, unknown>;
  expectedVersion?: number;
  status: ActionStatus;
  createdAt: Date;
  error?: string;
}

export interface OfflineStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export class MemoryOfflineStorage implements OfflineStorage {
  private data = new Map<string, string>();
  public getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  public setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

export class OfflineActionQueue {
  private queue: QueuedAction[] = [];
  private isOfflineMode = false;
  private readonly storageKey = "dewecs_uc3_offline_queue";

  constructor(private readonly storage: OfflineStorage = new MemoryOfflineStorage()) {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    const raw = this.storage.getItem(this.storageKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        this.queue = parsed.map((item: any) => ({
          ...item,
          createdAt: new Date(item.createdAt),
        }));
      } catch {
        this.queue = [];
      }
    }
  }

  private persist(): void {
    this.storage.setItem(this.storageKey, JSON.stringify(this.queue));
  }

  public setOfflineMode(enabled: boolean): void {
    this.isOfflineMode = enabled;
  }

  public isOffline(): boolean {
    return this.isOfflineMode;
  }

  public enqueue(
    actionId: string,
    type: QueuedAction["type"],
    payload: Record<string, unknown>,
    expectedVersion?: number
  ): QueuedAction {
    const item: QueuedAction = {
      actionId,
      type,
      payload,
      expectedVersion,
      status: "PENDING",
      createdAt: new Date(),
    };
    this.queue.push(item);
    this.persist();
    return item;
  }

  public getQueue(): QueuedAction[] {
    return [...this.queue];
  }

  public updateStatus(actionId: string, status: ActionStatus, error?: string): void {
    const item = this.queue.find((q) => q.actionId === actionId);
    if (item) {
      item.status = status;
      if (error) item.error = error;
      this.persist();
    }
  }

  public async replayQueue(
    executor: (action: QueuedAction) => Promise<{ ok: boolean; status: number; error?: string }>
  ): Promise<{ replayed: number; conflicts: number; failures: number }> {
    let replayed = 0;
    let conflicts = 0;
    let failures = 0;

    const pendingActions = this.queue.filter((a) => a.status === "PENDING");
    for (const action of pendingActions) {
      try {
        const res = await executor(action);
        if (res.ok || res.status === 200) {
          this.updateStatus(action.actionId, "CONFIRMED");
          replayed += 1;
        } else if (res.status === 409) {
          this.updateStatus(action.actionId, "CONFLICT", res.error ?? "Version conflict");
          conflicts += 1;
        } else {
          this.updateStatus(action.actionId, "FAILED", res.error ?? `HTTP ${res.status}`);
          failures += 1;
        }
      } catch (err: any) {
        this.updateStatus(action.actionId, "FAILED", err.message);
        failures += 1;
      }
    }

    return { replayed, conflicts, failures };
  }

  public clearConfirmed(): void {
    this.queue = this.queue.filter((a) => a.status !== "CONFIRMED");
    this.persist();
  }
}
