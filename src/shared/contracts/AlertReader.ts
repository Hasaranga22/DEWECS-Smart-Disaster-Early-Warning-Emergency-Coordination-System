import { Filter, HazardAlert } from "./types";

/**
 * Reader port provided by UC1 (Hazard Warning) for UC4 (Post Event Analysis).
 */
export interface AlertReader {
  /**
   * List hazard alerts matching the given filter.
   * @param filter Criteria to filter alerts
   */
  listAlerts(filter: Filter): Promise<HazardAlert[]>;
}
