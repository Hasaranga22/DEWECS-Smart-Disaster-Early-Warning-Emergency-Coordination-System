import { GroundReport } from "../domain/GroundReport";

/**
 * Repository interface for GroundReport persistence.
 *
 * Services depend ONLY on this interface — never on PrismaClient or
 * any database driver directly. This makes unit tests trivial to write
 * with the InMemoryReportRepository.
 */
export interface ReportRepository {
  /**
   * Persist a new report.
   * Implementors must throw DuplicateLocalIdError if localId already exists.
   */
  save(report: GroundReport): Promise<void>;

  /** Load a single report by its server-side UUID. Returns null if not found. */
  findById(id: string): Promise<GroundReport | null>;

  /**
   * Persist a modified report.
   * Implementors must use optimistic locking:
   *   UPDATE WHERE id = report.id AND version = expectedVersion
   * If no row is updated, throw VersionConflictError.
   */
  update(report: GroundReport, expectedVersion: number): Promise<void>;

  /** All reports visible to the duty officer queue (server-side only). */
  findAll(): Promise<GroundReport[]>;

  /** Reports submitted by a specific citizen. */
  findByReporter(reporterId: string): Promise<GroundReport[]>;

  /**
   * Find reports near a location within a time window for duplicate detection.
   *   - Same hazardType
   *   - Within radiusMeters of (lat, lng)
   *   - captureTime within windowMs milliseconds before captureTime
   */
  findNearby(params: {
    hazardType: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
    captureTime: Date;
    windowMs: number;
  }): Promise<GroundReport[]>;
}
