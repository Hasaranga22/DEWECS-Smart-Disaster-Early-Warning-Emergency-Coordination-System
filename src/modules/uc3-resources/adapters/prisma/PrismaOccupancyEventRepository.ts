import { prisma } from "@/shared/infra/prisma/client";
import { OccupancyEvent } from "../../domain/entities/OccupancyEvent";
import { OccupancyEventRepository } from "../repositories/OccupancyEventRepository";
import { Filter } from "@/shared/contracts/types";

export class PrismaOccupancyEventRepository implements OccupancyEventRepository {
  public async findById(id: string): Promise<OccupancyEvent | null> {
    const raw = await prisma.occupancyEvent.findUnique({ where: { id } });
    if (!raw) return null;
    return new OccupancyEvent({
      id: raw.id,
      shelterId: raw.shelterId,
      districtId: raw.districtId,
      previousCount: raw.previousCount,
      newCount: raw.newCount,
      actorId: raw.actorId,
      occurredAt: raw.occurredAt,
      actionId: raw.actionId,
    });
  }

  public async findByFilter(filter: Filter): Promise<OccupancyEvent[]> {
    const whereClause: any = {};
    if (filter.districtId) whereClause.districtId = filter.districtId;

    if (filter.from || filter.to || filter.cutoff) {
      whereClause.occurredAt = {};
      if (filter.from) whereClause.occurredAt.gte = filter.from;
      if (filter.to) whereClause.occurredAt.lte = filter.to;
      if (filter.cutoff) whereClause.occurredAt.lte = filter.cutoff;
    }

    const rawList = await prisma.occupancyEvent.findMany({ where: whereClause });
    return rawList.map(
      (raw: any) =>
        new OccupancyEvent({
          id: raw.id,
          shelterId: raw.shelterId,
          districtId: raw.districtId,
          previousCount: raw.previousCount,
          newCount: raw.newCount,
          actorId: raw.actorId,
          occurredAt: raw.occurredAt,
          actionId: raw.actionId,
        })
    );
  }

  public async save(event: OccupancyEvent): Promise<void> {
    await prisma.occupancyEvent.create({
      data: {
        id: event.id,
        shelterId: event.shelterId,
        districtId: event.districtId,
        previousCount: event.previousCount,
        newCount: event.newCount,
        actorId: event.actorId,
        occurredAt: event.occurredAt,
        actionId: event.actionId,
      },
    });
  }
}
