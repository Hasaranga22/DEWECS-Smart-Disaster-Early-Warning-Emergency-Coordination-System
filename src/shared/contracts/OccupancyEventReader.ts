import { Filter, OccupancyEvent } from "./types";

/**
 * Reader port provided by UC3 (Emergency Resources) for UC4 (Post Event Analysis).
 * Note: Returns dated occupancy events; hazardType is ignored per UC3 domain model.
 */
export interface OccupancyEventReader {
  /**
   * List shelter occupancy events matching the given filter.
   * @param filter Filter criteria (from, to, districtId, cutoff)
   */
  listEvents(filter: Filter): Promise<OccupancyEvent[]>;
}
