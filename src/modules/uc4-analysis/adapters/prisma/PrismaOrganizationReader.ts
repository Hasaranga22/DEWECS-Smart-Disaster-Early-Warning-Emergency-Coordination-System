import { prisma } from '@/shared/infra/prisma/client'
import type { OrganizationReader, Organization } from '../PartnerChannel'

export class PrismaOrganizationReader implements OrganizationReader {
  private static staticOrgs: Record<string, Organization> = {
    "00000000-0000-4000-8000-000000000300": { id: "00000000-0000-4000-8000-000000000300", name: "Sample Sri Lanka Army", type: "ARMED_FORCES" },
    "00000000-0000-4000-8000-000000000200": { id: "00000000-0000-4000-8000-000000000200", name: "Sample World Vision Lanka", type: "NGO" },
    "00000000-0000-4000-8000-000000000400": { id: "00000000-0000-4000-8000-000000000400", name: "Sample Private Donor", type: "PRIVATE_DONOR" },
    "75700352-5645-41a3-acc7-c8184f09cf35": { id: "75700352-5645-41a3-acc7-c8184f09cf35", name: "Sample Sri Lanka Army", type: "ARMED_FORCES" },
    "9c343cb9-c47a-4a05-bb4d-be2641a933b4": { id: "9c343cb9-c47a-4a05-bb4d-be2641a933b4", name: "Sample World Vision Lanka", type: "NGO" },
    "656c8a22-e60d-4e32-bfb5-8c5ed132d882": { id: "656c8a22-e60d-4e32-bfb5-8c5ed132d882", name: "Sample Private Donor", type: "PRIVATE_DONOR" },
  };

  getById(id: string): Organization | null {
    return PrismaOrganizationReader.staticOrgs[id] ?? null
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
