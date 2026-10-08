import { Distribution as ContractDistribution, Filter } from "@/shared/contracts/types";
import { DistributionReader } from "@/shared/contracts/DistributionReader";
import { DistributionRepository } from "../adapters/repositories/DistributionRepository";

/**
 * Implementation of DistributionReader for UC4 (Post Event Analysis).
 * Returns dated supply distribution records.
 * Note: hazardType is ignored because supply distribution is tracked per organization and shelter in UC3 domain.
 */
export class DistributionQueryService implements DistributionReader {
  constructor(private readonly distributionRepo: DistributionRepository) {}

  public async listDistributions(filter: Filter): Promise<ContractDistribution[]> {
    const distributions = await this.distributionRepo.findByFilter(filter);
    return distributions.map((d) => ({
      id: d.id,
      occurredAt: d.occurredAt,
      districtId: d.districtId,
      hazardType: filter.hazardType,
    }));
  }
}
