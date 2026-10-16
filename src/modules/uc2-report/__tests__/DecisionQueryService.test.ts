import { describe, it, expect, beforeEach } from "vitest";
import { DecisionQueryService } from "../services/DecisionQueryService";
import { InMemoryAuditRepository } from "./TestMocks";

describe("DecisionQueryService (UC4 Contract Reader)", () => {
  let audits: InMemoryAuditRepository;
  let service: DecisionQueryService;

  beforeEach(async () => {
    audits = new InMemoryAuditRepository();
    service = new DecisionQueryService(audits);

    // Seed audit decisions
    await audits.save({
      id: "audit-1",
      reportId: "rep-1",
      action: "VERIFIED",
      officerId: "officer-1",
      districtId: "colombo",
      hazardType: "FLOOD",
      occurredAt: new Date("2026-01-01T10:00:00Z"),
    });

    await audits.save({
      id: "audit-2",
      reportId: "rep-2",
      action: "REJECTED",
      officerId: "officer-2",
      districtId: "galle",
      hazardType: "LANDSLIDE",
      reason: "Spam",
      occurredAt: new Date("2026-01-01T11:00:00Z"),
    });

    await audits.save({
      id: "audit-3",
      reportId: "rep-1",
      action: "RESOLVED",
      officerId: "officer-1",
      districtId: "colombo",
      hazardType: "FLOOD",
      occurredAt: new Date("2026-01-01T12:00:00Z"),
    });

    await audits.save({
      id: "audit-4",
      reportId: "rep-1",
      action: "EXTENDED",
      officerId: "officer-1",
      districtId: "colombo",
      hazardType: "FLOOD",
      occurredAt: new Date("2026-01-01T13:00:00Z"),
    });
  });

  it("filters out RESOLVED and EXTENDED lifecycle events to avoid double-counting in UC4", async () => {
    const decisions = await service.listDecisions({});

    const actions = decisions.map((d) => d.id);
    expect(actions).toContain("audit-1");
    expect(actions).toContain("audit-2");
    expect(actions).not.toContain("audit-3");
    expect(actions).not.toContain("audit-4");
  });

  it("applies district and hazard filters accurately", async () => {
    const colomboDecisions = await service.listDecisions({ districtId: "colombo" });
    expect(colomboDecisions).toHaveLength(1);
    expect(colomboDecisions[0].districtId).toBe("colombo");

    const landslideDecisions = await service.listDecisions({ hazardType: "LANDSLIDE" });
    expect(landslideDecisions).toHaveLength(1);
    expect(landslideDecisions[0].hazardType).toBe("LANDSLIDE");
  });

  it("respects cutoff timestamp filter for historical snapshots", async () => {
    const cutoffDecisions = await service.listDecisions({
      cutoff: new Date("2026-01-01T10:30:00Z"),
    });

    expect(cutoffDecisions).toHaveLength(1);
    expect(cutoffDecisions[0].id).toBe("audit-1");
  });
});
