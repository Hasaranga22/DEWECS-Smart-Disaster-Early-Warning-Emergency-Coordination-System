import { prisma } from '@/shared/infra/prisma/client'
import type { OccupancyEventReader, OccupancyEvent, Filter } from '@/shared/contracts/types'
import type { Prisma } from '@/generated/prisma/client'
import { expandDistrictIds } from '../districtAliases'
import { buildSyntheticOccupancyEvents, canSynthesize } from '../dataBridges'

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

    if (filter.districtId !== undefined) clauses.push({ districtId: { in: expandDistrictIds(filter.districtId) } })
    if (filter.cutoff !== undefined) clauses.push({ occurredAt: { lte: filter.cutoff } })

    const rows = await prisma.occupancyEvent.findMany({
      where: clauses.length > 0 ? { AND: clauses } : {},
      orderBy: { occurredAt: 'asc' },
    })

    if (rows.length === 0 && canSynthesize(filter.from, filter.to)) {
      // Shelter state exists but no dated events were written for this window.
      const shelters = await prisma.shelter.findMany({
        where: {
          ...(filter.districtId !== undefined
            ? { districtId: { in: expandDistrictIds(filter.districtId) } }
            : {}),
          occupancy: { gt: 0 },
        },
        select: { id: true, districtId: true, occupancy: true },
      })
      if (shelters.length > 0) {
        return buildSyntheticOccupancyEvents(shelters, filter.from!, filter.to!)
      }
    }

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
