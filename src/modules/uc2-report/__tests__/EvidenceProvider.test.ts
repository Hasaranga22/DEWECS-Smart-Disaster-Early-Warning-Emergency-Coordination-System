import { describe, it, expect, beforeEach } from "vitest";
import { EvidenceProviderImpl } from "../services/EvidenceProviderImpl";
import { InMemoryReportRepository } from "../adapters/InMemoryReportRepository";
import { GroundReport } from "../domain/GroundReport";

describe("EvidenceProviderImpl (G07 - Only VERIFIED is Evidence)", () => {
  let reports: InMemoryReportRepository;
  let evidenceProvider: EvidenceProviderImpl;

  beforeEach(async () => {
    reports = new InMemoryReportRepository();
    reports.clear();
    evidenceProvider = new EvidenceProviderImpl(reports);

    // 1. A verified report in Colombo
    const verifiedReport = GroundReport.create({
      id: "report-verified-1",
      localId: "loc-1",
      reporterId: "cit-1",
      districtId: "colombo",
      hazardType: "FLOOD",
      description: "Severe flooding",
      latitude: 6.9271,
      longitude: 79.8612,
      locationSource: "GPS",
      confidence: "FULL",
      reviewStatus: "VERIFIED",
      severityIndication: "HIGH",
      version: 1,
      captureTime: new Date("2026-01-01T10:00:00Z"),
    });

    // 2. A pending report in Colombo
    const pendingReport = GroundReport.create({
      id: "report-pending-2",
      localId: "loc-2",
      reporterId: "cit-2",
      districtId: "colombo",
      hazardType: "FLOOD",
      description: "Water rising",
      latitude: 6.9275,
      longitude: 79.8615,
      locationSource: "GPS",
      confidence: "REDUCED",
      reviewStatus: "PENDING_REVIEW",
      version: 0,
      captureTime: new Date("2026-01-01T10:15:00Z"),
    });

    // 3. A rejected report in Colombo
    const rejectedReport = GroundReport.create({
      id: "report-rejected-3",
      localId: "loc-3",
      reporterId: "cit-3",
      districtId: "colombo",
      hazardType: "FLOOD",
      description: "False alarm",
      latitude: 6.928,
      longitude: 79.862,
      locationSource: "GPS",
      confidence: "REDUCED",
      reviewStatus: "REJECTED",
      version: 1,
      captureTime: new Date("2026-01-01T10:20:00Z"),
    });

    // 4. A verified report in Galle that links to report-verified-1 (corroboration)
    const galleVerifiedReport = GroundReport.create({
      id: "report-verified-galle",
      localId: "loc-4",
      reporterId: "cit-4",
      districtId: "galle",
      hazardType: "FLOOD",
      description: "Flooding in Galle",
      latitude: 6.0535,
      longitude: 80.221,
      locationSource: "GPS",
      confidence: "FULL",
      reviewStatus: "VERIFIED",
      severityIndication: "MEDIUM",
      version: 1,
      captureTime: new Date("2026-01-01T11:00:00Z"),
    });

    // 5. A second verified report in Colombo linking to report-verified-1
    const corroboratingReport = GroundReport.create({
      id: "report-corrob-5",
      localId: "loc-5",
      reporterId: "cit-5",
      districtId: "colombo",
      hazardType: "FLOOD",
      description: "Also seeing heavy flood here",
      latitude: 6.9272,
      longitude: 79.8613,
      locationSource: "GPS",
      confidence: "FULL",
      reviewStatus: "VERIFIED",
      severityIndication: "HIGH",
      linkedToReportId: "report-verified-1",
      version: 1,
      captureTime: new Date("2026-01-01T10:25:00Z"),
    });

    await reports.save(verifiedReport);
    await reports.save(pendingReport);
    await reports.save(rejectedReport);
    await reports.save(galleVerifiedReport);
    await reports.save(corroboratingReport);
  });

  it("G07: only VERIFIED reports are returned, excluding PENDING and REJECTED", async () => {
    const evidence = await evidenceProvider.listVerified();

    const ids = evidence.map((e) => e.reportId);
    expect(ids).toContain("report-verified-1");
    expect(ids).toContain("report-verified-galle");
    expect(ids).toContain("report-corrob-5");

    // Unverified reports must NEVER be exposed as evidence
    expect(ids).not.toContain("report-pending-2");
    expect(ids).not.toContain("report-rejected-3");
  });

  it("filters verified evidence by district when districtId is provided", async () => {
    const colomboEvidence = await evidenceProvider.listVerified("colombo");
    expect(colomboEvidence.every((e) => e.districtId === "colombo")).toBe(true);

    const galleEvidence = await evidenceProvider.listVerified("galle");
    expect(galleEvidence).toHaveLength(1);
    expect(galleEvidence[0].reportId).toBe("report-verified-galle");
  });

  it("computes corroborationCount for verified incidents with linked reports", async () => {
    const evidence = await evidenceProvider.listVerified("colombo");
    const primary = evidence.find((e) => e.reportId === "report-verified-1");

    expect(primary).toBeDefined();
    // report-corrob-5 links to report-verified-1
    expect(primary?.corroborationCount).toBe(1);
  });
});
