import 'dotenv/config'

import { describe, expect, it } from 'vitest'

import { PARTNER_ORGS } from '@/app/resources/analysis/_types'
import { prisma } from '@/shared/infra/prisma/client'

/**
 * The share UI posts PARTNER_ORGS ids to POST /api/analysis/[id]/share, and
 * `report_share.organization_id` is a real FK to `organization` — so every
 * partner the UI offers MUST exist in the DB (the sync OrganizationReader's
 * static map can otherwise mask the gap and let the insert blow up).
 */
const describeDb = describe.skipIf(process.env.DATABASE_URL === undefined || process.env.DATABASE_URL === '')

describeDb('UC4 partner organisations (UI <-> DB FK contract)', () => {
  it('every PARTNER_ORGS id offered by the share UI exists in the organization table', async () => {
    for (const org of PARTNER_ORGS) {
      const row = await prisma.organization.findUnique({
        where: { id: org.id },
        select: { id: true },
      })
      expect(
        row,
        `partner org ${org.id} ("${org.name}") missing from organization table — add it to prisma/seed.ts`,
      ).not.toBeNull()
    }
    await prisma.$disconnect()
  })
})
