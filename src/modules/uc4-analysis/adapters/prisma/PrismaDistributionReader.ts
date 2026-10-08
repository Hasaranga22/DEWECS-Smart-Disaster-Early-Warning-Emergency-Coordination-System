import { prisma } from '@/shared/infra/prisma/client'
import type { DistributionReader, Distribution, Filter } from '@/shared/contracts/types'
import type { Prisma } from '@/generated/prisma/client'

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

    if (filter.districtId !== undefined) clauses.push({ districtId: filter.districtId })
    if (filter.cutoff !== undefined) clauses.push({ occurredAt: { lte: filter.cutoff } })

    const rows = await prisma.distribution.findMany({
      where: clauses.length > 0 ? { AND: clauses } : {},
      include: { stock: true },
      orderBy: { occurredAt: 'asc' },
    })

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
