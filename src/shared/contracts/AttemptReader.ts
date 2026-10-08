import { Filter, NotificationAttempt } from "./types";

/**
 * Reader port provided by UC1 (Hazard Warning) for UC4 (Post Event Analysis).
 */
export interface AttemptReader {
  /**
   * List notification attempts matching the given filter.
   * @param filter Criteria to filter attempts
   */
  listAttempts(filter: Filter): Promise<NotificationAttempt[]>;
}
