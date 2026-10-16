import {
  AggregationTimeoutError,
  ForbiddenError,
  NotFoundError,
  PdfExportError,
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

import { parsePdfExportParams, pdfFilename } from './_params'

export const runtime = 'nodejs'

/**
 * GET /api/analysis/[id]/pdf — export the saved snapshot as a PDF.
 * Renders ONLY from the snapshot (never re-aggregates), in ?lang= when
 * requested (falling back to the report's own language, §5.4).
 * ?mask=true marks the download as a privacy-masked export (NA-4).
 * Zero-KPI snapshots self-heal on read first (live processes only).
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
      return Response.json({ error: 'NotFound' }, { status: 404 })
    }
    if (isLiveRoute() && shouldHydrateReport(report)) {
      report = await hydrateIncompleteSnapshot(report, uc4.aggregation)
    }

    const { lang, mask } = parsePdfExportParams(new URL(request.url))
    const bytes = await uc4.pdfExporter.export(report, lang ?? report.filters.language)

    // Copy into an ArrayBuffer-backed view: pdf-lib returns
    // Uint8Array<ArrayBufferLike>, which BodyInit does not accept.
    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${pdfFilename(id, mask)}"`,
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
    if (error instanceof PdfExportError) {
      // Exception flow E3: export failure surfaces as 503 with the cause.
      return Response.json(
        { error: 'PdfExportError', message: error.message },
        { status: 503 },
      )
    }
    if (error instanceof AggregationTimeoutError) {
      return Response.json({ error: 'Timeout' }, { status: 503 })
    }
    console.error('GET /api/analysis/[id]/pdf failed:', error)
    return Response.json({ error: 'Internal' }, { status: 500 })
  }
}
