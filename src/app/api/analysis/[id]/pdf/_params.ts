import type { Language } from "@/modules/uc4-analysis/domain/ReportFilters";

const LANGS: readonly string[] = ["EN", "SI", "TA"];

export interface PdfExportParams {
  lang: Language | undefined;
  mask: boolean;
}

export function parsePdfExportParams(url: URL): PdfExportParams {
  const rawLang = url.searchParams.get("lang");
  const lang = rawLang ? rawLang.toUpperCase() : "";
  const rawMask = url.searchParams.get("mask");
  return {
    lang: LANGS.includes(lang) ? (lang as Language) : undefined,
    mask: rawMask !== null && rawMask.toLowerCase() === "true",
  };
}

export function pdfFilename(reportId: string, mask: boolean): string {
  return mask ? `report-${reportId}-masked.pdf` : `report-${reportId}.pdf`;
}
