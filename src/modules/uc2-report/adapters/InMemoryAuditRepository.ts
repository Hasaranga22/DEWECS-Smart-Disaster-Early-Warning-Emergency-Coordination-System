import { AuditRepository, ReportAuditEntry } from "../services/ReviewService";

/**
 * In-memory implementation of the AuditRepository.
 * Used for testing and the development server until Prisma is connected.
 */
export class InMemoryAuditRepository implements AuditRepository {
  public entries: ReportAuditEntry[] = [];

  async save(entry: ReportAuditEntry): Promise<void> {
    this.entries.push(entry);
  }

  async findByReport(reportId: string): Promise<ReportAuditEntry[]> {
    return this.entries.filter((e) => e.reportId === reportId);
  }

  async findAll(): Promise<ReportAuditEntry[]> {
    return this.entries;
  }
}
