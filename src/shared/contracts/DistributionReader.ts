import { Distribution, Filter } from "./types";

/**
 * Reader port provided by UC3 (Emergency Resources) for UC4 (Post Event Analysis).
 * Note: Returns dated supply distribution events; hazardType is ignored per UC3 domain model.
 */
export interface DistributionReader {
  /**
   * List supply distributions matching the given filter.
   * @param filter Filter criteria (from, to, districtId, cutoff)
   */
  listDistributions(filter: Filter): Promise<Distribution[]>;
}
