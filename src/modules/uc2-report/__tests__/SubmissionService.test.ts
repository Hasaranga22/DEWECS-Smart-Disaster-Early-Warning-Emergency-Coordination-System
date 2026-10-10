import { describe, it, expect, beforeEach } from "vitest";
import { SubmissionService } from "../services/SubmissionService";
import { ReportValidator } from "../services/ReportValidator";
import { DuplicateDetector } from "../services/DuplicateDetector";
import { InMemoryReportRepository } from "../adapters/InMemoryReportRepository";
import { IdbOutboxRepository } from "../client/IdbOutboxRepository";
import { SequentialIdGenerator, StaticClock } from "./TestMocks";
import { GroundReport } from "../domain/GroundReport";

// Note: In Node.js environment (Vitest), idb-keyval will fail because it expects
// an IndexedDB browser environment. We must mock the outbox repository completely.
class MockOutboxRepository extends IdbOutboxRepository {
  public savedEntries: any[] = [];
  override async save(entry: any) { this.savedEntries.push(entry); }
  override async getAll() { return this.savedEntries; }
  override async getPending() { return this.savedEntries; }
  override async remove() {}
}

describe("SubmissionService", () => {
  let reports: InMemoryReportRepository;
  let outbox: MockOutboxRepository;
  let service: SubmissionService;
  let clock: StaticClock;

  beforeEach(() => {
    reports = new InMemoryReportRepository();
    reports.clear(); // Reset global store between tests
    outbox = new MockOutboxRepository();
    clock = new StaticClock();
    const ids = new SequentialIdGenerator();

    const validator = new ReportValidator(reports, clock, ids);
    const duplicateDetector = new DuplicateDetector(reports);

    service = new SubmissionService(
      reports,
      validator,
      duplicateDetector,
      outbox,
      clock
    );
  });

  const baseDraft = {
    reporterId: "cit-1",
    districtId: "kandy",
    hazardType: "FLOOD" as const,
    description: "Water rising",
    latitude: 7.2906,
    longitude: 80.6337,
    locationSource: "GPS" as const,
    localId: "loc-123",
    captureTime: new Date(),
  };

  it("should route to offline Outbox if isOnline = false", async () => {
    const result = await service.submit(baseDraft, false);

    expect(result.channel).toBe("offline");
    if (result.channel !== "offline") return; // type guard
    expect(result.outboxEntry.status).toBe("PENDING_SYNC");
    
    // Nothing should be in the central DB
    const allServerReports = await reports.findAll();
    expect(allServerReports).toHaveLength(0);
  });

  it("should route to central DB if isOnline = true", async () => {
    const result = await service.submit(baseDraft, true);

    expect(result.channel).toBe("online");
    if (result.channel !== "online") return;
    
    expect(result.report.reviewStatus).toBe("PENDING_REVIEW");
    
    // It should exist in DB
    const saved = await reports.findById(result.report.id);
    expect(saved).not.toBeNull();
  });

  it("should detect duplicate and link if submitted within 500m and 60min", async () => {
    // 1. Submit first report
    const firstResult = await service.submit(baseDraft, true);
    
    // 2. Submit second report nearby (same hazard, slightly offset coordinates)
    const duplicateDraft = {
      ...baseDraft,
      localId: "loc-456",
      reporterId: "cit-2",
      latitude: 7.2907, // Just a tiny bit north (well within 500m)
      longitude: 80.6337,
    };

    const secondResult = await service.submit(duplicateDraft, true);

    expect(secondResult.channel).toBe("online");
    if (secondResult.channel !== "online" || firstResult.channel !== "online") return;

    expect(secondResult.isCorroboration).toBe(true);
    expect(secondResult.report.linkedToReportId).toBe(firstResult.report.id);
  });

  it("should NOT link if hazard type is different despite being close", async () => {
    await service.submit(baseDraft, true);
    
    const duplicateDraft = {
      ...baseDraft,
      localId: "loc-456",
      hazardType: "LANDSLIDE" as const, // Different hazard!
    };

    const secondResult = await service.submit(duplicateDraft, true);
    
    if (secondResult.channel !== "online") return;
    expect(secondResult.isCorroboration).toBe(false);
    expect(secondResult.report.linkedToReportId).toBeUndefined();
  });
});
