import { prisma } from '@/shared/infra/prisma/client'
import type { OccupancyEventReader, OccupancyEvent, Filter } from '@/shared/contracts/types'
import type { Prisma } from '@/generated/prisma/client'

export class PrismaOccupancyEventReader implements OccupancyEventReader {
  async listEvents(filter: Filter): Promise<OccupancyEvent[]> {
    const clauses: Prisma.OccupancyEventWhereInput[] = []

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

    const rows = await prisma.occupancyEvent.findMany({
      where: clauses.length > 0 ? { AND: clauses } : {},
      orderBy: { occurredAt: 'asc' },
    })

    return rows.map((row) => ({
      id: row.id,
      shelterId: row.shelterId,
      districtId: row.districtId,
      previousCount: row.previousCount,
      newCount: row.newCount,
      occurredAt: row.occurredAt,
    }))
  }
}
