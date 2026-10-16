import { describe, expect, it } from "vitest";
import { parsePdfExportParams, pdfFilename } from "../_params";

describe("parsePdfExportParams", () => {
  it("returns no lang and mask=false for an empty query", () => {
    expect(parsePdfExportParams(new URL("http://x/api/analysis/1/pdf"))).toEqual({
      lang: undefined,
      mask: false,
    });
  });

  it("accepts EN/SI/TA in any case", () => {
    expect(parsePdfExportParams(new URL("http://x/pdf?lang=EN")).lang).toBe("EN");
    expect(parsePdfExportParams(new URL("http://x/pdf?lang=si")).lang).toBe("SI");
    expect(parsePdfExportParams(new URL("http://x/pdf?lang=Ta")).lang).toBe("TA");
  });

  it("drops an unsupported language so the route falls back to the report language", () => {
    expect(parsePdfExportParams(new URL("http://x/pdf?lang=FR")).lang).toBeUndefined();
    expect(parsePdfExportParams(new URL("http://x/pdf?lang=")).lang).toBeUndefined();
  });

  it("parses mask=true and mask=false, defaulting to false", () => {
    expect(parsePdfExportParams(new URL("http://x/pdf?mask=true")).mask).toBe(true);
    expect(parsePdfExportParams(new URL("http://x/pdf?mask=TRUE")).mask).toBe(true);
    expect(parsePdfExportParams(new URL("http://x/pdf?mask=false")).mask).toBe(false);
    expect(parsePdfExportParams(new URL("http://x/pdf?mask=yes")).mask).toBe(false);
    expect(parsePdfExportParams(new URL("http://x/pdf")).mask).toBe(false);
  });
});

describe("pdfFilename", () => {
  it("adds the -masked suffix only when masking is on", () => {
    expect(pdfFilename("rep-1", false)).toBe("report-rep-1.pdf");
    expect(pdfFilename("rep-1", true)).toBe("report-rep-1-masked.pdf");
  });
});
