import { describe, it, expect, beforeEach } from "vitest";
import { OutboxSyncService } from "../services/OutboxSyncService";
import { ReportValidator } from "../services/ReportValidator";
import { DuplicateDetector } from "../services/DuplicateDetector";
import { InMemoryReportRepository } from "../adapters/InMemoryReportRepository";
import { IdbOutboxRepository } from "../client/IdbOutboxRepository";
import { LocalOutboxEntry } from "../domain/LocalOutboxEntry";
import { SequentialIdGenerator, StaticClock } from "./TestMocks";

class MockOutboxRepo extends IdbOutboxRepository {
  public entries: LocalOutboxEntry[] = [];

  override async save(entry: LocalOutboxEntry): Promise<void> {
    const idx = this.entries.findIndex((e) => e.localId === entry.localId);
    if (idx >= 0) {
      this.entries[idx] = { ...entry };
    } else {
      this.entries.push({ ...entry });
    }
  }

  override async getAll(): Promise<LocalOutboxEntry[]> {
    return [...this.entries];
  }

  override async getPending(): Promise<LocalOutboxEntry[]> {
    return this.entries.filter((e) => e.status === "PENDING_SYNC" || e.status === "SYNCING");
  }

  override async remove(localId: string): Promise<void> {
    this.entries = this.entries.filter((e) => e.localId !== localId);
  }
}

describe("OutboxSyncService (G03 & Permanent Sync Failure)", () => {
  let reports: InMemoryReportRepository;
  let outbox: MockOutboxRepo;
  let validator: ReportValidator;
  let detector: DuplicateDetector;
  let clock: StaticClock;
  let syncService: OutboxSyncService;

  beforeEach(() => {
    reports = new InMemoryReportRepository();
    reports.clear();
    outbox = new MockOutboxRepo();
    clock = new StaticClock();
    const ids = new SequentialIdGenerator();

    validator = new ReportValidator(reports, clock, ids);
    detector = new DuplicateDetector(reports);

    syncService = new OutboxSyncService(outbox, validator, detector, reports, clock);
  });

  const baseEntry: LocalOutboxEntry = {
    localId: "offline-loc-1",
    hazardType: "FLOOD",
    description: "River overflowed bank",
    latitude: 6.9271,
    longitude: 79.8612,
    locationSource: "GPS",
    confidence: "REDUCED",
    status: "PENDING_SYNC",
    captureTime: "2026-01-01T10:00:00.000Z",
  };

  it("successfully syncs pending outbox entry to server and removes from outbox", async () => {
    await outbox.save(baseEntry);

    const summary = await syncService.syncAll("cit-1", "colombo");

    expect(summary.attempted).toBe(1);
    expect(summary.succeeded).toBe(1);
    expect(summary.failed).toBe(0);

    // Should be saved in server reports
    const serverReports = await reports.findAll();
    expect(serverReports).toHaveLength(1);
    expect(serverReports[0].localId).toBe("offline-loc-1");

    // Outbox entry should be removed
    const remainingOutbox = await outbox.getAll();
    expect(remainingOutbox).toHaveLength(0);
  });

  it("G03: idempotent sync - when same localId is already on server, removes from outbox without duplicating", async () => {
    // 1. First sync succeeds
    await outbox.save(baseEntry);
    await syncService.syncAll("cit-1", "colombo");
    expect(await reports.findAll()).toHaveLength(1);

    // 2. Simulate re-attempt with same localId (e.g. client retried after network glitch)
    await outbox.save(baseEntry);
    const summary = await syncService.syncAll("cit-1", "colombo");

    expect(summary.succeeded).toBe(1);

    // Central reports must still only have 1 report (no duplicate row)
    const serverReports = await reports.findAll();
    expect(serverReports).toHaveLength(1);

    // Outbox should be clean
    expect(await outbox.getAll()).toHaveLength(0);
  });

  it("handles retry exhaustion and marks entry permanently FAILED after 3 attempts", async () => {
    // Invalid entry that will fail validation (missing hazardType)
    const invalidEntry: LocalOutboxEntry = {
      ...baseEntry,
      hazardType: "" as any,
    };
    await outbox.save(invalidEntry);

    // Attempt 1: fails, status remains PENDING_SYNC with attempt 1 recorded
    let summary = await syncService.syncAll("cit-1", "colombo");
    expect(summary.failed).toBe(1);
    let entries = await outbox.getAll();
    expect(entries[0].status).toBe("PENDING_SYNC");
    expect(entries[0].failureReason).toContain("attempt 1");

    // Attempt 2: fails, status remains PENDING_SYNC with attempt 2 recorded
    summary = await syncService.syncAll("cit-1", "colombo");
    expect(summary.failed).toBe(1);
    entries = await outbox.getAll();
    expect(entries[0].status).toBe("PENDING_SYNC");
    expect(entries[0].failureReason).toContain("attempt 2");

    // Attempt 3: fails, exceeds MAX_SYNC_ATTEMPTS, status becomes FAILED
    summary = await syncService.syncAll("cit-1", "colombo");
    expect(summary.permanentlyFailed).toBe(1);
    entries = await outbox.getAll();
    expect(entries[0].status).toBe("FAILED");
    expect(entries[0].failureReason).toContain("Could not be saved or sent after 3 attempts");
  });
});
