import { NextResponse } from 'next/server'

import {
  AggregationTimeoutError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/modules/uc4-analysis/domain/errors'
import type { HazardType } from '@/shared/contracts/types'
import { getActor, requireRole } from '@/shared/access'
import { uc4 } from '@/shared/infra/container'

export const runtime = 'nodejs'

/**
 * POST /api/analysis — generate a report snapshot (DMC Official only).
 * Thin route: auth → parse body → one service call → map errors.
 */
export async function POST(request: Request) {
  try {
    const actor = await getActor(request)
    requireRole(actor, ['DMC_OFFICIAL'])

    const body = await request.json()
    const report = await uc4.snapshotService.generate(body, actor)

    return NextResponse.json(
      {
        reportId: report.id,
        generatedAt: report.generatedAt,
        sourceCutoff: report.sourceCutoff,
        filters: report.filters,
        metrics: report.metrics,
      },
      { status: 201 },
    )
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
    console.error('POST /api/analysis failed:', error)
    return NextResponse.json({ error: 'Internal' }, { status: 500 })
  }
}

/**
 * GET /api/analysis — report history (DMC Official only).
 */
export async function GET(request: Request) {
  try {
    const actor = await getActor(request)
    requireRole(actor, ['DMC_OFFICIAL'])

    const { searchParams } = new URL(request.url)
    const limitParam = Number(searchParams.get('limit'))
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.floor(limitParam) : 50

    const reports = await uc4.snapshotRepository.list({
      limit,
      districtId: searchParams.get('districtId') ?? undefined,
      hazardType: (searchParams.get('hazardType') ?? undefined) as HazardType | undefined,
    })

    return NextResponse.json(reports, { status: 200 })
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
    console.error('GET /api/analysis failed:', error)
    return NextResponse.json({ error: 'Internal' }, { status: 500 })
  }
}
