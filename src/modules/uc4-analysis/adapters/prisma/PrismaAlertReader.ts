import { prisma } from '@/shared/infra/prisma/client'
import type { AlertReader, HazardAlert, Filter, HazardType } from '@/shared/contracts/types'
import type { Prisma } from '@/generated/prisma/client'
import { canonicalDistrictName, expandDistrictIds } from '../districtAliases'

export class PrismaAlertReader implements AlertReader {
  async listAlerts(filter: Filter): Promise<HazardAlert[]> {
    const clauses: Prisma.HazardAlertWhereInput[] = []

    if (filter.from || filter.to) {
      clauses.push({
        occurredAt: {
          ...(filter.from ? { gte: filter.from } : {}),
          ...(filter.to ? { lte: filter.to } : {}),
        },
      })
    }

    if (filter.districtId !== undefined) {
      // Equivalent ids for the same real district (seed vs legacy schemes).
      const ids = expandDistrictIds(filter.districtId)
      const name = canonicalDistrictName(filter.districtId)
      const matches: Prisma.HazardAlertWhereInput[] = [
        { targetDistricts: { some: { districtId: { in: ids } } } },
        // Alerts targeting a basin that covers the district.
        { targetBasins: { some: { basin: { districts: { some: { districtId: { in: ids } } } } } } },
      ]
      if (name !== undefined) {
        // Alerts whose target rows were lost (district removed) still carry
        // the district name in the message text.
        matches.push({
          AND: [
            { targetDistricts: { none: {} } },
            { targetBasins: { none: {} } },
            { message: { contains: name, mode: 'insensitive' } },
          ],
        })
      }
      clauses.push({ OR: matches })
    }
    if (filter.hazardType !== undefined) clauses.push({ hazardType: filter.hazardType })
    if (filter.cutoff !== undefined) clauses.push({ createdAt: { lte: filter.cutoff } })

    const rows = await prisma.hazardAlert.findMany({
      where: clauses.length > 0 ? { AND: clauses } : {},
      orderBy: { occurredAt: 'asc' },
    })

    return rows.map((row) => ({
      id: row.id,
      hazardType: row.hazardType as HazardType,
      severity: row.severity,
      occurredAt: row.occurredAt,
    }))
  }
}
