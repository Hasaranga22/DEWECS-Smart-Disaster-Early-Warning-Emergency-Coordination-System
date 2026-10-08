/**
 * AuditLogger — external dependency port (constructor-injected, README §14:
 * interfaces for every external dependency).
 *
 * UC4 calls:
 * - logGeneration after a snapshot was successfully persisted
 * - logFailure when generation fails (e.g. aggregation timeout)
 */
export interface AuditLogger {
  logGeneration(reportId: string, actorId: string): void
  logFailure(reason: string, actorId: string): void
}
