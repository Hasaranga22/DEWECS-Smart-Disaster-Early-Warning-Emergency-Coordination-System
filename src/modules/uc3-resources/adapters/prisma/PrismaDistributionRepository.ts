import { prisma } from "@/shared/infra/prisma/client";
import { Distribution } from "../../domain/entities/Distribution";
import { DistributionRepository } from "../repositories/DistributionRepository";
import { Filter } from "@/shared/contracts/types";

export class PrismaDistributionRepository implements DistributionRepository {
  public async findById(id: string): Promise<Distribution | null> {
    const raw = await prisma.distribution.findUnique({ where: { id } });
    if (!raw) return null;
    return new Distribution({
      id: raw.id,
      stockId: raw.stockId,
      destinationShelterId: raw.destinationShelterId,
      organizationId: raw.organizationId,
      districtId: raw.districtId,
      quantity: raw.quantity,
      actorId: raw.actorId,
      occurredAt: raw.occurredAt,
      actionId: raw.actionId,
    });
  }

  public async findByFilter(filter: Filter): Promise<Distribution[]> {
    const whereClause: any = {};
    if (filter.districtId) whereClause.districtId = filter.districtId;

    if (filter.from || filter.to || filter.cutoff) {
      whereClause.occurredAt = {};
      if (filter.from) whereClause.occurredAt.gte = filter.from;
      if (filter.to) whereClause.occurredAt.lte = filter.to;
      if (filter.cutoff) whereClause.occurredAt.lte = filter.cutoff;
    }

    const rawList = await prisma.distribution.findMany({ where: whereClause });
    return rawList.map(
      (raw: any) =>
        new Distribution({
          id: raw.id,
          stockId: raw.stockId,
          destinationShelterId: raw.destinationShelterId,
          organizationId: raw.organizationId,
          districtId: raw.districtId,
          quantity: raw.quantity,
          actorId: raw.actorId,
          occurredAt: raw.occurredAt,
          actionId: raw.actionId,
        })
    );
  }

  public async save(distribution: Distribution): Promise<void> {
    await prisma.distribution.create({
      data: {
        id: distribution.id,
        stockId: distribution.stockId,
        destinationShelterId: distribution.destinationShelterId,
        organizationId: distribution.organizationId,
        districtId: distribution.districtId,
        quantity: distribution.quantity,
        actorId: distribution.actorId,
        occurredAt: distribution.occurredAt,
        actionId: distribution.actionId,
      },
    });
  }
}
