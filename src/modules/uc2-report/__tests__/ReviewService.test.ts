import { describe, it, expect, beforeEach } from "vitest";
import { ReviewService } from "../services/ReviewService";
import { InMemoryReportRepository } from "../adapters/InMemoryReportRepository";
import { InMemoryAuditRepository, SequentialIdGenerator, StaticClock } from "./TestMocks";
import { GroundReport } from "../domain/GroundReport";
import { VersionConflictError } from "../domain/errors";

describe("ReviewService", () => {
  let reports: InMemoryReportRepository;
  let audits: InMemoryAuditRepository;
  let service: ReviewService;
  let clock: StaticClock;

  beforeEach(async () => {
    reports = new InMemoryReportRepository();
    reports.clear(); // Reset global store between tests
    audits = new InMemoryAuditRepository();
    clock = new StaticClock();
    const ids = new SequentialIdGenerator();

    service = new ReviewService(reports, audits, clock, ids);

    // Seed a pending report
    const draft = GroundReport.create({
      id: "report-123",
      localId: "local-123",
      reporterId: "citizen-1",
      districtId: "galle",
      hazardType: "LANDSLIDE",
      description: "Mud on road",
      latitude: 6.0,
      longitude: 80.0,
      locationSource: "GPS",
      confidence: "REDUCED",
      reviewStatus: "PENDING_REVIEW",
      version: 0,
      captureTime: clock.now(),
    });
    await reports.save(draft);
  });

  it("should verify a report, persist it, and write an audit log", async () => {
    await service.verify({
      reportId: "report-123",
      expectedVersion: 0,
      officerId: "officer-1",
      severityIndication: "HIGH",
    });

    const saved = await reports.findById("report-123");
    expect(saved?.reviewStatus).toBe("VERIFIED");
    expect(saved?.severityIndication).toBe("HIGH");
    expect(saved?.version).toBe(1);

    const auditLogs = await audits.findByReport("report-123");
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].action).toBe("VERIFIED");
    expect(auditLogs[0].officerId).toBe("officer-1");
  });

  it("should throw VersionConflictError during concurrent modifications", async () => {
    // Both officers click a button at the exact same time.
    // They both load the report from the DB while it is still version 0.
    const promiseA = service.verify({
      reportId: "report-123",
      expectedVersion: 0,
      officerId: "officer-A",
      severityIndication: "HIGH",
    });

    const promiseB = service.reject({
      reportId: "report-123",
      expectedVersion: 0,
      officerId: "officer-B",
      reason: "Duplicate",
    });

    // Run them concurrently
    const [resultA, resultB] = await Promise.allSettled([promiseA, promiseB]);

    // One must succeed and one must fail with a VersionConflictError
    const statuses = [resultA.status, resultB.status];
    expect(statuses).toContain("fulfilled");
    expect(statuses).toContain("rejected");

    const rejected = resultA.status === "rejected" ? resultA : resultB;
    expect((rejected as PromiseRejectedResult).reason).toBeInstanceOf(VersionConflictError);
  });
});
