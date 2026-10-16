import type { OrganizationReader } from "@/modules/uc4-analysis/adapters/PartnerChannel";
import type { ReportShare } from "@/modules/uc4-analysis/domain/ReportShare";
import type { ShareOutcome } from "@/modules/uc4-analysis/domain/ShareOutcome";

export function buildShareHistory(
  rows: ReportShare[],
  organizations: OrganizationReader,
): ShareOutcome[] {
  return rows.map((row) => ({
    ...row,
    organizationName: organizations.getById(row.organizationId)?.name ?? "?",
  }));
}
