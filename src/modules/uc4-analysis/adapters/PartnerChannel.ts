import type { AnalysisReport } from '../domain/AnalysisReport'

/** A partner organisation that can receive report shares. */
export interface Organization {
  id: string
  name: string
  type: string
}

/**
 * PartnerChannel — Strategy port for delivering a report to one organisation.
 * Implementations throw on failure; ShareService records the failure and
 * continues with the remaining recipients (BR9).
 */
export interface PartnerChannel {
  send(report: AnalysisReport, organization: Organization): Promise<void>
}

/** Synchronous lookup port for partner organisations. */
export interface OrganizationReader {
  getById(id: string): Organization | null
}
