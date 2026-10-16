import { api, AnalysisReport } from "./_types";

export type GenerateReportInput = Parameters<typeof api.generateReport>[0];

export function buildScopedRegeneration(
  filters: AnalysisReport["filters"],
  scope: { districtId?: string; hazardType?: string },
): GenerateReportInput {
  return {
    from: filters.from,
    to: filters.to,
    districtId:
      scope.districtId !== undefined
        ? scope.districtId.trim() || undefined
        : filters.districtId,
    hazardType:
      scope.hazardType !== undefined
        ? scope.hazardType.trim() || undefined
        : filters.hazardType,
    includedSections: filters.includedSections,
    language: filters.language,
  };
}
