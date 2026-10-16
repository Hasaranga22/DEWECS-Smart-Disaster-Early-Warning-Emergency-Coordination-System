import { Distribution as ContractDistribution, Filter } from "@/shared/contracts/types";
import { DistributionReader } from "@/shared/contracts/DistributionReader";
import { DistributionRepository } from "../adapters/repositories/DistributionRepository";
import { SupplyStockRepository } from "../adapters/repositories/SupplyStockRepository";

/**
 * Implementation of DistributionReader for UC4 (Post Event Analysis).
 * Returns dated supply distribution records.
 * Note: hazardType is ignored because supply distribution is tracked per organization and shelter in UC3 domain.
 */
export class DistributionQueryService implements DistributionReader {
  constructor(
    private readonly distributionRepo: DistributionRepository,
    private readonly stockRepo: SupplyStockRepository,
  ) {}

  public async listDistributions(filter: Filter): Promise<ContractDistribution[]> {
    const distributions = await this.distributionRepo.findByFilter(filter);
    const results: ContractDistribution[] = [];

    for (const d of distributions) {
      const stock = await this.stockRepo.findById(d.stockId);
      results.push({
        id: d.id,
        supplyType: stock?.supplyType ?? d.stockId,
        districtId: d.districtId,
        distributed: d.quantity,
        total: stock?.onHand ?? 0,
        occurredAt: d.occurredAt,
      });
    }

    return results;
  }
}
