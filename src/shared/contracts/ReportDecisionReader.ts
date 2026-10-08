import { Filter, ReportDecision } from "./types";

/**
 * Reader port provided by UC2 (Ground Report) for UC4 (Post Event Analysis).
 */
export interface ReportDecisionReader {
  /**
   * List report decisions matching the given filter.
   * @param filter Criteria to filter report decisions
   */
  listDecisions(filter: Filter): Promise<ReportDecision[]>;
}
