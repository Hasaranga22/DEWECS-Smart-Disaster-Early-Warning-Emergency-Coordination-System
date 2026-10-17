import { NextResponse } from 'next/server'

import {
  AggregationTimeoutError,
  ForbiddenError,
  ValidationError,
} from '@/modules/uc4-analysis/domain/errors'
import type { HazardType } from '@/shared/contracts/types'
import { getActor, requireRole } from '@/shared/access'
import { uc4 } from '@/shared/infra/container'
import { ensureForRoute } from '@/modules/uc4-analysis/seed/ensureUc4SampleData'
import { ReportFilterValidator } from '@/modules/uc4-analysis/services/ReportFilterValidator'

export const runtime = 'nodejs'

/** Same aggregation budget as SnapshotService (docs/uc4-context.md §6.4). */
const AGGREGATION_TIMEOUT_MS = 60_000

const ALL_SECTIONS = ['ALERTS', 'REACH', 'REPORTS', 'SHELTERS', 'SUPPLIES'] as const

/**
 * GET /api/analysis/live — live (non-frozen) metrics from the shared DB.
 *
 * Reuses the same 5 Prisma readers as POST /api/analysis (UC1 alerts,
 * UC2 ground reports + audits, UC3 shelters/supplies), but does NOT persist
 * a snapshot and does NOT freeze anything — every call reflects whatever
 * partners have written since the previous call.
 *
 * Query: from, to (ISO date or datetime, required), districtId?, hazardType?
 */
export async function GET(request: Request) {
  try {
    const actor = await getActor(request)
    requireRole(actor, ['DMC_OFFICIAL'])

    await ensureForRoute()

    const { searchParams } = new URL(request.url)
    const input = {
      from: searchParams.get('from') ?? undefined,
      to: searchParams.get('to') ?? undefined,
      districtId: searchParams.get('districtId') ?? undefined,
      hazardType: (searchParams.get('hazardType') ?? undefined) as HazardType | undefined,
      // Live metrics always compute every section; sections only gate what a
      // saved report includes in its body/PDF, which we do not build here.
      includedSections: [...ALL_SECTIONS],
      language: 'EN',
    }

    const filters = new ReportFilterValidator().validate(input)

    const sourceCutoff = new Date()
    const deadline = new Date(sourceCutoff.getTime() + AGGREGATION_TIMEOUT_MS)
    const metrics = await uc4.aggregation.aggregate(filters, sourceCutoff, deadline)

    return NextResponse.json(
      {
        metrics,
        generatedAt: new Date().toISOString(),
        sourceCutoff: sourceCutoff.toISOString(),
        filters: {
          from: filters.from.toISOString(),
          to: filters.to.toISOString(),
          districtId: filters.districtId,
          hazardType: filters.hazardType,
          includedSections: filters.includedSections,
          language: filters.language,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: 'ValidationError', fields: error.fields }, { status: 400 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (error instanceof AggregationTimeoutError) {
      return NextResponse.json({ error: 'Timeout' }, { status: 503 })
    }
    console.error('GET /api/analysis/live failed:', error)
    return NextResponse.json({ error: 'Internal' }, { status: 500 })
  }
}
