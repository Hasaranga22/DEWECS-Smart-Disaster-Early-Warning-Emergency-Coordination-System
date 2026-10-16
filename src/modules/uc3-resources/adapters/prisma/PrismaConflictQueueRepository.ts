import { prisma } from "@/shared/infra/prisma/client";
import { ConflictQueueItem } from "../../domain/entities/ConflictQueueItem";
import { ConflictQueueRepository } from "../repositories/ConflictQueueRepository";

export class PrismaConflictQueueRepository implements ConflictQueueRepository {
  public async findById(id: string): Promise<ConflictQueueItem | null> {
    const raw = await prisma.conflictQueueItem.findUnique({ where: { id } });
    if (!raw) return null;
    return new ConflictQueueItem({
      id: raw.id,
      actionType: raw.actionType,
      payload: (raw.payload as Record<string, unknown>) ?? {},
      expectedVersion: raw.expectedVersion,
      actualVersion: raw.actualVersion,
      status: raw.status as any,
      createdAt: raw.createdAt,
      resolvedAt: raw.resolvedAt ?? undefined,
      resolvedBy: raw.resolvedBy ?? undefined,
    });
  }

  public async findOpenByDistrictId(districtId: string): Promise<ConflictQueueItem[]> {
    const rawList = await prisma.conflictQueueItem.findMany({ where: { status: "OPEN" } });
    return rawList
      .map(
        (raw: any) =>
          new ConflictQueueItem({
            id: raw.id,
            actionType: raw.actionType,
            payload: (raw.payload as Record<string, unknown>) ?? {},
            expectedVersion: raw.expectedVersion,
            actualVersion: raw.actualVersion,
            status: raw.status as any,
            createdAt: raw.createdAt,
            resolvedAt: raw.resolvedAt ?? undefined,
            resolvedBy: raw.resolvedBy ?? undefined,
          })
      )
      .filter((item: ConflictQueueItem) => item.districtId === districtId);
  }

  public async save(item: ConflictQueueItem): Promise<void> {
    const existing = await prisma.conflictQueueItem.findUnique({ where: { id: item.id } });
    if (!existing) {
      await prisma.conflictQueueItem.create({
        data: {
          id: item.id,
          actionType: item.actionType,
          payload: item.payload as any,
          expectedVersion: item.expectedVersion,
          actualVersion: item.actualVersion,
          status: item.status as any,
          createdAt: item.createdAt,
          resolvedAt: item.resolvedAt,
          resolvedBy: item.resolvedBy,
        },
      });
      return;
    }

    await prisma.conflictQueueItem.update({
      where: { id: item.id },
      data: {
        status: item.status as any,
        resolvedAt: item.resolvedAt,
        resolvedBy: item.resolvedBy,
      },
    });
  }
}
