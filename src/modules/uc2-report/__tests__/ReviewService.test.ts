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

  it("G05: reject requires reason, updates status to REJECTED, and logs audit", async () => {
    await service.reject({
      reportId: "report-123",
      expectedVersion: 0,
      officerId: "officer-1",
      reason: "Insufficient evidence or hoax report",
    });

    const saved = await reports.findById("report-123");
    expect(saved?.reviewStatus).toBe("REJECTED");
    expect(saved?.version).toBe(1);

    const auditLogs = await audits.findByReport("report-123");
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].action).toBe("REJECTED");
    expect(auditLogs[0].reason).toBe("Insufficient evidence or hoax report");
    expect(auditLogs[0].officerId).toBe("officer-1");
  });

  it("G05: throws when attempting to review non-existent report", async () => {
    await expect(
      service.reject({
        reportId: "non-existent",
        expectedVersion: 0,
        officerId: "officer-1",
        reason: "Fake",
      })
    ).rejects.toThrow('Report "non-existent" not found.');
  });

  it("G05: requestInfo sets NEEDS_INFO and reporter addClarification returns it to PENDING_REVIEW", async () => {
    // 1. Officer requests more information
    await service.requestInfo({
      reportId: "report-123",
      expectedVersion: 0,
      officerId: "officer-1",
      note: "Please provide a clearer photo of the water level.",
    });

    let saved = await reports.findById("report-123");
    expect(saved?.reviewStatus).toBe("NEEDS_INFO");
    expect(saved?.version).toBe(1);

    // 2. Reporter submits clarification with photo
    await service.addClarification({
      reportId: "report-123",
      expectedVersion: 1,
      updatedPhoto: "data:image/jpeg;base64,waterLevelConfirmed",
    });

    saved = await reports.findById("report-123");
    expect(saved?.reviewStatus).toBe("PENDING_REVIEW");
    expect(saved?.version).toBe(2);
    expect(saved?.photo).toBe("data:image/jpeg;base64,waterLevelConfirmed");
    expect(saved?.confidence).toBe("FULL");

    // Check complete audit history
    const auditLogs = await audits.findByReport("report-123");
    expect(auditLogs).toHaveLength(2);
    expect(auditLogs[0].action).toBe("NEEDS_INFO");
    expect(auditLogs[0].note).toBe("Please provide a clearer photo of the water level.");
    expect(auditLogs[1].action).toBe("CLARIFIED");
  });

  it("should mark verified report as resolved and record audit", async () => {
    await service.verify({
      reportId: "report-123",
      expectedVersion: 0,
      officerId: "officer-1",
    });

    await service.resolveIncident({
      reportId: "report-123",
      expectedVersion: 1,
      officerId: "officer-1",
      note: "Water receded and road re-opened.",
    });

    const saved = await reports.findById("report-123");
    expect(saved?.reviewStatus).toBe("VERIFIED");
    expect(saved?.mapStatus).toBe("RESOLVED");
    expect(saved?.resolvedByOfficerId).toBe("officer-1");
    expect(saved?.version).toBe(2);

    const auditLogs = await audits.findByReport("report-123");
    expect(auditLogs.map((a) => a.action)).toEqual(["VERIFIED", "RESOLVED"]);
  });

  it("should extend map visibility for verified active incident", async () => {
    await service.verify({
      reportId: "report-123",
      expectedVersion: 0,
      officerId: "officer-1",
    });

    const before = await reports.findById("report-123");
    const initialExpiry = before?.mapVisibleUntil?.getTime() ?? 0;

    await service.extendIncident({
      reportId: "report-123",
      expectedVersion: 1,
      officerId: "officer-1",
      note: "Flood ongoing, extending map alert.",
    });

    const after = await reports.findById("report-123");
    expect(after?.version).toBe(2);
    expect(after?.mapVisibleUntil?.getTime()).toBeGreaterThanOrEqual(initialExpiry);

    const auditLogs = await audits.findByReport("report-123");
    expect(auditLogs.map((a) => a.action)).toEqual(["VERIFIED", "EXTENDED"]);
  });
});
