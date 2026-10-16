import type { OrganizationReader, Organization } from '@/modules/uc4-analysis/adapters/PartnerChannel'
export class InMemoryOrganizationReader implements OrganizationReader {
  private data: Organization[] = []

  getById(id: string): Organization | null {
    return this.data.find((o) => o.id === id) ?? null
  }

  seed(rows: Organization[]) {
    this.data = rows
  }

  clear() {
    this.data = []
  }

  add(org: Organization) {
    this.data.push(org)
  }
}

