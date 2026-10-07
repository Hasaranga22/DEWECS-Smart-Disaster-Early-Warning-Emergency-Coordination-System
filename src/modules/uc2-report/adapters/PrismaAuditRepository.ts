import { AuditRepository, ReportAuditEntry } from "../services/ReviewService";
import { prisma } from "@/shared/infra/prisma";

export class PrismaAuditRepository implements AuditRepository {
  async save(entry: ReportAuditEntry): Promise<void> {
    await prisma.reportAuditEntry.create({
      data: {
        id: entry.id,
        reportId: entry.reportId,
        action: entry.action,
        officerId: entry.officerId,
        reason: entry.reason,
        note: entry.note,
        occurredAt: entry.occurredAt,
        districtId: entry.districtId,
        hazardType: entry.hazardType as any,
      },
    });
  }

  async findByReport(reportId: string): Promise<ReportAuditEntry[]> {
    const records = await prisma.reportAuditEntry.findMany({
      where: { reportId },
      orderBy: { occurredAt: 'asc' },
    });
    
    // The types align perfectly with Prisma's output
    return records as ReportAuditEntry[];
  }

  async findAll(): Promise<ReportAuditEntry[]> {
    const records = await prisma.reportAuditEntry.findMany({
      orderBy: { occurredAt: 'asc' },
    });
    return records as ReportAuditEntry[];
  }
}
