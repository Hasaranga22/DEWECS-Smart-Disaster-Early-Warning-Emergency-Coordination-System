import { prisma } from '@/shared/infra/prisma/client'
import type { AttemptReader, NotificationAttempt, Filter, HazardType, NotificationChannel, DeliveryStatus } from '@/shared/contracts/types'
import type { Prisma } from '@/generated/prisma/client'

export class PrismaAttemptReader implements AttemptReader {
  async listAttempts(filter: Filter): Promise<NotificationAttempt[]> {
    const clauses: Prisma.NotificationAttemptWhereInput[] = []

    if (filter.from || filter.to) {
      clauses.push({
        occurredAt: {
          ...(filter.from ? { gte: filter.from } : {}),
          ...(filter.to ? { lte: filter.to } : {}),
        },
      })
    }

    if (filter.districtId !== undefined) clauses.push({ districtId: filter.districtId })
    if (filter.hazardType !== undefined) clauses.push({ hazardType: filter.hazardType })
    if (filter.cutoff !== undefined) clauses.push({ occurredAt: { lte: filter.cutoff } })

    const rows = await prisma.notificationAttempt.findMany({
      where: clauses.length > 0 ? { AND: clauses } : {},
      orderBy: { occurredAt: 'asc' },
    })

    return rows.map((row) => ({
      id: row.id,
      alertId: row.alertId,
      citizenId: row.citizenId,
      districtId: row.districtId,
      hazardType: row.hazardType as HazardType,
      channel: row.channel as NotificationChannel,
      deliveryStatus: row.status as DeliveryStatus,
      occurredAt: row.occurredAt,
      attemptAt: row.sentAt ?? row.occurredAt,
    }))
  }
}
