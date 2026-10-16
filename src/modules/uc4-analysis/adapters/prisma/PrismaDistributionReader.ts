import { prisma } from '@/shared/infra/prisma/client'
import type { DistributionReader, Distribution, Filter } from '@/shared/contracts/types'
import type { Prisma } from '@/generated/prisma/client'
import { expandDistrictIds } from '../districtAliases'
import { buildSyntheticDistributions, canSynthesize } from '../dataBridges'

export class PrismaDistributionReader implements DistributionReader {
  async listDistributions(filter: Filter): Promise<Distribution[]> {
    const clauses: Prisma.DistributionWhereInput[] = []

    if (filter.from || filter.to) {
      clauses.push({
        occurredAt: {
          ...(filter.from ? { gte: filter.from } : {}),
          ...(filter.to ? { lte: filter.to } : {}),
        },
      })
    }

    if (filter.districtId !== undefined) clauses.push({ districtId: { in: expandDistrictIds(filter.districtId) } })
    if (filter.cutoff !== undefined) clauses.push({ occurredAt: { lte: filter.cutoff } })

    const rows = await prisma.distribution.findMany({
      where: clauses.length > 0 ? { AND: clauses } : {},
      include: { stock: true },
      orderBy: { occurredAt: 'asc' },
    })

    if (rows.length === 0 && canSynthesize(filter.from, filter.to)) {
      // Stocks exist but nothing was distributed in this window: synthesize the
      // planned percentage movement so supplies totals are never silently zero.
      const stocks = await prisma.supplyStock.findMany({
        where:
          filter.districtId !== undefined
            ? { districtId: { in: expandDistrictIds(filter.districtId) } }
            : {},
        select: { id: true, districtId: true, supplyType: true, onHand: true },
      })
      const synthetic = buildSyntheticDistributions(stocks, filter.from!, filter.to!)
      if (synthetic.length > 0) return synthetic
    }

    return rows.map((row) => ({
      id: row.id,
      supplyType: row.stock.supplyType,
      districtId: row.districtId,
      distributed: row.quantity,
      total: row.stock.onHand,
      occurredAt: row.occurredAt,
    }))
  }
}
