import { describe, expect, it } from "vitest";
import type { OrganizationReader } from "@/modules/uc4-analysis/adapters/PartnerChannel";
import type { ReportShare } from "@/modules/uc4-analysis/domain/ReportShare";
import { buildShareHistory } from "../_history";

const reader: OrganizationReader = {
  getById(id: string) {
    if (id === "org-1") return { id, name: "Sample Army", type: "ARMED_FORCES" };
    return null;
  },
};

const rows: ReportShare[] = [
  { id: "s1", reportId: "r1", organizationId: "org-1", status: "SENT", attemptedAt: new Date("2026-08-10T10:00:00.000Z"), actorId: "officer-1" },
  { id: "s2", reportId: "r1", organizationId: "org-unknown", status: "FAILED", attemptedAt: new Date("2026-08-10T11:00:00.000Z"), actorId: "officer-1", failureReason: "SMTP down" },
];

describe("buildShareHistory", () => {
  it("enriches rows with the organisation name", () => {
    const out = buildShareHistory(rows, reader);
    expect(out[0]).toMatchObject({ id: "s1", organizationName: "Sample Army", status: "SENT" });
  });

  it("marks rows for unknown organisations with '?'", () => {
    const out = buildShareHistory(rows, reader);
    expect(out[1]).toMatchObject({ id: "s2", organizationName: "?", failureReason: "SMTP down" });
  });

  it("returns all rows oldest attempt first, preserving order", () => {
    const out = buildShareHistory(rows, reader);
    expect(out.map((o) => o.id)).toEqual(["s1", "s2"]);
  });

  it("returns an empty list when nothing was shared", () => {
    expect(buildShareHistory([], reader)).toEqual([]);
  });
});
