import { NextResponse } from 'next/server'

import {
  AggregationTimeoutError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/modules/uc4-analysis/domain/errors'
import { getActor, requireRole } from '@/shared/access'
import { uc4 } from '@/shared/infra/container'
import {
  ensureForRoute,
  hydrateIncompleteSnapshot,
  isLiveRoute,
  shouldHydrateReport,
} from '@/modules/uc4-analysis/seed/ensureUc4SampleData'

export const runtime = 'nodejs'

/**
 * GET /api/analysis/[id] — fetch one saved snapshot (DMC Official only).
 * Zero-KPI snapshots self-heal on read (auto-hydrate, live processes only).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await getActor(request)
    requireRole(actor, ['DMC_OFFICIAL'])

    await ensureForRoute()
    const { id } = await params
    let report = await uc4.snapshotRepository.getById(id)
    if (!report) {
      return NextResponse.json({ error: 'NotFound' }, { status: 404 })
    }
    if (isLiveRoute() && shouldHydrateReport(report)) {
      report = await hydrateIncompleteSnapshot(report, uc4.aggregation)
    }

    return NextResponse.json(report, { status: 200 })
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: 'ValidationError', fields: error.fields }, { status: 400 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: 'NotFound' }, { status: 404 })
    }
    if (error instanceof AggregationTimeoutError) {
      return NextResponse.json({ error: 'Timeout' }, { status: 503 })
    }
    console.error('GET /api/analysis/[id] failed:', error)
    return NextResponse.json({ error: 'Internal' }, { status: 500 })
  }
}
