import { describe, expect, it } from "vitest";
import { buildQueryString, prefillFromQuery } from "../_prefill";

const COLOMBO = "00000000-0000-4000-8000-000000000010";

describe("buildQueryString", () => {
  it("returns empty string for no params", () => {
    expect(buildQueryString({})).toBe("");
  });

  it("forwards scalar params", () => {
    const qs = buildQueryString({ from: "2026-08-01", lang: "SI" });
    expect(qs).toBe("from=2026-08-01&lang=SI");
  });

  it("forwards the first value of array params and drops undefined", () => {
    const qs = buildQueryString({ to: ["2026-08-31", "2026-09-30"], district: undefined });
    expect(qs).toBe("to=2026-08-31");
  });
});

describe("prefillFromQuery", () => {
  it("returns an empty object when no params are present", () => {
    expect(prefillFromQuery({})).toEqual({});
  });

  it("prefills from/to/districtId/hazardType/language from a full query", () => {
    expect(
      prefillFromQuery({
        from: "2026-08-01",
        to: "2026-08-31",
        districtId: COLOMBO,
        hazardType: "FLOOD",
        language: "TA",
      }),
    ).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
      districtId: COLOMBO,
      hazardType: "FLOOD",
      language: "TA",
    });
  });

  it("maps district name alias and districtId alias, preferring districtId", () => {
    expect(prefillFromQuery({ district: "Colombo" })).toEqual({ districtId: COLOMBO });
    expect(prefillFromQuery({ district: "colombo", districtId: COLOMBO })).toEqual({
      districtId: COLOMBO,
    });
  });

  it("accepts lang as the alias for language", () => {
    expect(prefillFromQuery({ lang: "si" })).toEqual({ language: "SI" });
  });

  it("drops invalid dates, hazard types, languages and districts", () => {
    expect(
      prefillFromQuery({
        from: "not-a-date",
        to: "2026-13-99",
        hazardType: "TSUNAMI",
        language: "FR",
        district: "Atlantis",
      }),
    ).toEqual({});
  });

  it("uses the first entry of array-valued params", () => {
    expect(prefillFromQuery({ from: ["2026-08-01", "2026-09-01"] })).toEqual({
      from: "2026-08-01",
    });
  });
});
