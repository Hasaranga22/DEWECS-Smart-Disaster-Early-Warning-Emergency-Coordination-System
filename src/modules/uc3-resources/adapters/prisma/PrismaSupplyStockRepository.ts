import { prisma } from "@/shared/infra/prisma/client";
import { SupplyStock } from "../../domain/entities/SupplyStock";
import { SupplyStockRepository } from "../repositories/SupplyStockRepository";
import { VersionConflictError } from "@/shared/infra/errors";

export class PrismaSupplyStockRepository implements SupplyStockRepository {
  public async findById(id: string): Promise<SupplyStock | null> {
    const raw = await prisma.supplyStock.findUnique({ where: { id } });
    if (!raw) return null;
    return new SupplyStock({
      id: raw.id,
      organizationId: raw.organizationId,
      districtId: raw.districtId,
      supplyType: raw.supplyType,
      onHand: raw.onHand,
      version: raw.version,
    });
  }

  public async findByDistrictId(districtId: string): Promise<SupplyStock[]> {
    const rawList = await prisma.supplyStock.findMany({ where: { districtId } });
    return rawList.map(
      (raw: any) =>
        new SupplyStock({
          id: raw.id,
          organizationId: raw.organizationId,
          districtId: raw.districtId,
          supplyType: raw.supplyType,
          onHand: raw.onHand,
          version: raw.version,
        })
    );
  }

  public async findAll(): Promise<SupplyStock[]> {
    const rawList = await prisma.supplyStock.findMany();
    return rawList.map(
      (raw: any) =>
        new SupplyStock({
          id: raw.id,
          organizationId: raw.organizationId,
          districtId: raw.districtId,
          supplyType: raw.supplyType,
          onHand: raw.onHand,
          version: raw.version,
        })
    );
  }

  public async save(stock: SupplyStock): Promise<void> {
    const existing = await prisma.supplyStock.findUnique({ where: { id: stock.id } });
    if (!existing) {
      await prisma.supplyStock.create({
        data: {
          id: stock.id,
          organizationId: stock.organizationId,
          districtId: stock.districtId,
          supplyType: stock.supplyType,
          onHand: stock.onHand,
          version: stock.version,
        },
      });
      return;
    }

    const result = await prisma.supplyStock.updateMany({
      where: { id: stock.id, version: existing.version },
      data: {
        onHand: stock.onHand,
        version: { increment: 1 },
      },
    });

    if (result.count === 0) {
      throw new VersionConflictError(`Supply stock '${stock.id}' was updated by another process`);
    }
  }
}
