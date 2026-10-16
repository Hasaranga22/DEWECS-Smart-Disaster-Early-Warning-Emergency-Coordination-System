import { prisma } from '@/shared/infra/prisma/client'
import type {
  SupplyStockReader,
  SupplyStock,
  Filter,
} from '@/shared/contracts/types'

export class PrismaSupplyStockReader implements SupplyStockReader {
  async listStocks(f: Filter): Promise<SupplyStock[]> {
    const rows = await prisma.supplyStock.findMany({
      where: {
        ...(f.districtId ? { districtId: f.districtId } : {}),
      },
    })
    return rows.map(r => ({
      id: r.id,
      organizationId: r.organizationId,
      districtId: r.districtId,
      supplyType: r.supplyType,
      onHand: r.onHand,
      updatedAt: r.updatedAt,
    }))
  }
}
