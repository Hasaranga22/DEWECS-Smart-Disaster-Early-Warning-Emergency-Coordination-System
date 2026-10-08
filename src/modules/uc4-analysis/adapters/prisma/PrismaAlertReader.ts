import { prisma } from '@/shared/infra/prisma/client'
import type { AlertReader, HazardAlert, Filter, HazardType } from '@/shared/contracts/types'

export class PrismaAlertReader implements AlertReader {
  async listAlerts(filter: Filter): Promise<HazardAlert[]> {
    const clauses: any[] = []

    if (filter.from || filter.to) {
      clauses.push({
        occurredAt: {
          ...(filter.from ? { gte: filter.from } : {}),
          ...(filter.to ? { lte: filter.to } : {}),
        },
      })
    }

    if (filter.districtId !== undefined) {
      clauses.push({
        targetDistricts: { some: { districtId: filter.districtId } },
      })
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
