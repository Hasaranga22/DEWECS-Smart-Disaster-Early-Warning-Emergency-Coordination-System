import { Filter, OccupancyEvent as ContractOccupancyEvent } from "@/shared/contracts/types";
import { OccupancyEventReader } from "@/shared/contracts/OccupancyEventReader";
import { OccupancyEventRepository } from "../adapters/repositories/OccupancyEventRepository";

/**
 * Implementation of OccupancyEventReader for UC4 (Post Event Analysis).
 * Returns dated shelter occupancy events.
 * Note: hazardType is ignored because shelter occupancy is not tied to a specific hazard type in UC3 domain.
 */
export class OccupancyEventQueryService implements OccupancyEventReader {
  constructor(private readonly eventRepo: OccupancyEventRepository) {}

  public async listEvents(filter: Filter): Promise<ContractOccupancyEvent[]> {
    const events = await this.eventRepo.findByFilter(filter);
    return events.map((e) => ({
      id: e.id,
      shelterId: e.shelterId,
      districtId: e.districtId,
      previousCount: e.previousCount,
      newCount: e.newCount,
      occurredAt: e.occurredAt,
    }));
  }
}
