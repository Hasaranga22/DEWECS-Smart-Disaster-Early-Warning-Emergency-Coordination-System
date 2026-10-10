import {
  AggregationTimeoutError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/modules/uc4-analysis/domain/errors'
import { getActor, requireRole } from '@/shared/access'
import { uc4 } from '@/shared/infra/container'

export const runtime = 'nodejs'

/**
 * GET /api/analysis/[id]/pdf — export the saved snapshot as a PDF.
 * Renders ONLY from the snapshot (never re-aggregates) in the report's
 * own language (§5.4).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await getActor(request)
    requireRole(actor, ['DMC_OFFICIAL'])

    const { id } = await params
    const report = await uc4.snapshotRepository.getById(id)
    if (!report) {
      return Response.json({ error: 'NotFound' }, { status: 404 })
    }

    const bytes = await uc4.pdfExporter.export(report, report.filters.language)

    // Copy into an ArrayBuffer-backed view: pdf-lib returns
    // Uint8Array<ArrayBufferLike>, which BodyInit does not accept.
    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="report-${id}.pdf"`,
      },
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return Response.json({ error: 'ValidationError', fields: error.fields }, { status: 400 })
    }
    if (error instanceof ForbiddenError) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (error instanceof NotFoundError) {
      return Response.json({ error: 'NotFound' }, { status: 404 })
    }
    if (error instanceof AggregationTimeoutError) {
      return Response.json({ error: 'Timeout' }, { status: 503 })
    }
    console.error('GET /api/analysis/[id]/pdf failed:', error)
    return Response.json({ error: 'Internal' }, { status: 500 })
  }
}
