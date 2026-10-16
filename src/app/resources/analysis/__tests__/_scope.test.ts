import { describe, expect, it } from "vitest";
import { buildScopedRegeneration } from "../_scope";
import { AnalysisReport } from "../_types";

const baseFilters: AnalysisReport["filters"] = {
  from: "2026-08-01T00:00:00.000Z",
  to: "2026-08-31T23:59:59.000Z",
  districtId: "00000000-0000-4000-8000-000000000002",
  hazardType: "FLOOD",
  includedSections: ["ALERTS", "SHELTERS"],
  language: "SI",
};

describe("buildScopedRegeneration", () => {
  it("keeps the original from/to/includedSections/language and applies the new scope", () => {
    const input = buildScopedRegeneration(baseFilters, {
      districtId: "00000000-0000-4000-8000-000000000010",
      hazardType: "CYCLONE",
    });
    expect(input).toEqual({
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-08-31T23:59:59.000Z",
      districtId: "00000000-0000-4000-8000-000000000010",
      hazardType: "CYCLONE",
      includedSections: ["ALERTS", "SHELTERS"],
      language: "SI",
    });
  });

  it("omits empty scope values so they become all-districts / all-hazards", () => {
    const input = buildScopedRegeneration(baseFilters, { districtId: "", hazardType: "" });
    expect(input.districtId).toBeUndefined();
    expect(input.hazardType).toBeUndefined();
    expect(input.includedSections).toEqual(["ALERTS", "SHELTERS"]);
    expect(input.language).toBe("SI");
  });

  it("leaves a scope field untouched when only the other one changes", () => {
    const input = buildScopedRegeneration(baseFilters, { hazardType: "LANDSLIDE" });
    expect(input.districtId).toBe("00000000-0000-4000-8000-000000000002");
    expect(input.hazardType).toBe("LANDSLIDE");
  });
});
