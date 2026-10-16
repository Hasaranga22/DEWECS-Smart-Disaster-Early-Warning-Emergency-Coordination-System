import { NextResponse } from 'next/server'

import {
  AggregationTimeoutError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/modules/uc4-analysis/domain/errors'
import { getActor, requireRole } from '@/shared/access'
import { uc4 } from '@/shared/infra/container'

import { buildShareHistory } from './_history'

export const runtime = 'nodejs'

function errorResponse(error: unknown, label: string): Response {
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
  console.error(`${label} failed:`, error)
  return NextResponse.json({ error: 'Internal' }, { status: 500 })
}

/**
 * GET /api/analysis/[id]/share — the append-only share audit history for
 * one snapshot (A2/NA-4): every prior SENT/FAILED attempt, enriched with
 * the recipient organisation's name.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await getActor(request)
    requireRole(actor, ['DMC_OFFICIAL'])

    const { id } = await params
    const rows = await uc4.shareLogRepository.listByReport(id)
    const outcomes = buildShareHistory(rows, uc4.organizationReader)

    return NextResponse.json({ outcomes }, { status: 200 })
  } catch (error) {
    return errorResponse(error, 'GET /api/analysis/[id]/share')
  }
}

/**
 * POST /api/analysis/[id]/share — share a snapshot with partner
 * organisations. Always 200 with per-recipient outcomes, even when some
 * deliveries fail (BR8/BR9); only auth/validation errors map to 4xx.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await getActor(request)
    requireRole(actor, ['DMC_OFFICIAL'])

    const { id } = await params
    const body = await request.json()
    const outcomes = await uc4.shareService.share(id, body.organizationIds ?? [], actor)

    return NextResponse.json({ outcomes }, { status: 200 })
  } catch (error) {
    return errorResponse(error, 'POST /api/analysis/[id]/share')
  }
}
