import { VerifiedEvidence } from "./types";

/**
 * Port provided by UC2 (Ground Report) to UC1 (Hazard Warning).
 * Exposes verified ground report evidence.
 */
export interface VerifiedEvidenceProvider {
  /**
   * List verified evidence reports, optionally filtered by district ID.
   * @param districtId Optional district filter
   */
  listVerified(districtId?: string): Promise<VerifiedEvidence[]>;
}
