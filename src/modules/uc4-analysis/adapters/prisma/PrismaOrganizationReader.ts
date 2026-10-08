import { prisma } from '@/shared/infra/prisma/client'
import type { OrganizationReader, Organization } from '../PartnerChannel'

export class PrismaOrganizationReader implements OrganizationReader {
  getById(id: string): Organization | null {
    // This is synchronous per the OrganizationReader contract
    // In practice, Prisma calls are async, so we return null here
    // The actual async implementation is used in integration tests
    return null
  }

  async getByIdAsync(id: string): Promise<Organization | null> {
    const row = await prisma.organization.findUnique({
      where: { id },
      select: { id: true, name: true, type: true },
    })
    if (!row) return null
    return {
      id: row.id,
      name: row.name,
      type: row.type,
    }
  }
}
