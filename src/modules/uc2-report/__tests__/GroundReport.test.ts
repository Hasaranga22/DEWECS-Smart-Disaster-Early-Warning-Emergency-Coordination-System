import { describe, it, expect, beforeEach } from "vitest";
import { GroundReport } from "../domain/GroundReport";
import { InvalidStateTransitionError } from "../domain/errors";

describe("GroundReport Domain Entity", () => {
  let report: GroundReport;

  beforeEach(() => {
    report = GroundReport.create({
      id: "report-1",
      localId: "local-1",
      reporterId: "reporter-1",
      districtId: "colombo",
      hazardType: "FLOOD",
      description: "Severe flooding on main road",
      latitude: 6.9271,
      longitude: 79.8612,
      locationSource: "GPS",
      confidence: "FULL",
      reviewStatus: "PENDING_REVIEW",
      version: 0,
      captureTime: new Date(),
    });
  });

  it("should successfully transition to VERIFIED and increment version", () => {
    expect(report.version).toBe(0);
    expect(report.reviewStatus).toBe("PENDING_REVIEW");

    report.verify("HIGH");

    expect(report.reviewStatus).toBe("VERIFIED");
    expect(report.severityIndication).toBe("HIGH");
    expect(report.version).toBe(1);
  });

  it("should successfully transition to REJECTED and increment version", () => {
    report.reject("Not a disaster, just a broken pipe.");

    expect(report.reviewStatus).toBe("REJECTED");
    expect(report.version).toBe(1);
  });

  it("should throw error if rejecting without a reason", () => {
    expect(() => report.reject("   ")).toThrowError("A rejection reason is required.");
  });

  it("should throw InvalidStateTransitionError if verifying an already rejected report", () => {
    report.reject("Spam");
    expect(() => report.verify("LOW")).toThrowError(InvalidStateTransitionError);
  });

  it("should handle the NEEDS_INFO -> PENDING_REVIEW clarification loop", () => {
    // Officer requests info
    report.requestInfo();
    expect(report.reviewStatus).toBe("NEEDS_INFO");
    expect(report.version).toBe(1);

    // Citizen provides info (clarifies)
    report.addClarification("Here is a better photo");
    expect(report.reviewStatus).toBe("PENDING_REVIEW");
    expect(report.version).toBe(2); // Version increments again!

    // Officer finally verifies
    report.verify("MEDIUM");
    expect(report.reviewStatus).toBe("VERIFIED");
    expect(report.version).toBe(3);
  });

  it("resolves a verified incident without changing its review decision", () => {
    report.verify("HIGH");
    const resolvedAt = new Date("2026-10-16T09:00:00.000Z");

    report.resolveIncident("officer-1", resolvedAt);

    expect(report.reviewStatus).toBe("VERIFIED");
    expect(report.mapStatus).toBe("RESOLVED");
    expect(report.resolvedAt).toEqual(resolvedAt);
    expect(report.resolvedByOfficerId).toBe("officer-1");
    expect(report.version).toBe(2);
  });

  it("extends an active verified incident without changing its review decision", () => {
    report.verify("MEDIUM");
    const firstExpiry = new Date("2026-10-23T09:00:00.000Z");
    const extendedExpiry = new Date("2026-10-30T09:00:00.000Z");
    report.activateOnMap(firstExpiry);

    report.extendMapVisibility(extendedExpiry);

    expect(report.reviewStatus).toBe("VERIFIED");
    expect(report.mapStatus).toBe("ACTIVE");
    expect(report.mapVisibleUntil).toEqual(extendedExpiry);
    expect(report.version).toBe(2);
  });

  it("does not resolve an unverified incident", () => {
    expect(() => report.resolveIncident("officer-1", new Date())).toThrowError(InvalidStateTransitionError);
  });
});
