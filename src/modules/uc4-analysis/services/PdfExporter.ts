import { PDFDocument, PDFFont, StandardFonts } from 'pdf-lib'

import type { AnalysisReport } from '../domain/AnalysisReport'
import { PdfExportError } from '../domain/errors'
import { LABELS } from '../domain/i18n'
import type { Language } from '../domain/ReportFilters'

// ─── Layout constants ─────────────────────────────────────────────────────────

/** A4 portrait in points (595 × 842). */
const PAGE_WIDTH = 595
const PAGE_HEIGHT = 842
const MARGIN = 50
const LINE_HEIGHT = 16
const SECTION_GAP = 8

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * pdf-lib's standard fonts (Helvetica / Helvetica-Bold) only encode WinAnsi
 * characters — Sinhala and Tamil labels from i18n.ts would throw
 * "WinAnsi cannot encode ..." and fail the whole export. Replace only the
 * unencodable characters with '?' so every language still yields a valid PDF.
 */
function sanitizeForFont(text: string, font: PDFFont): string {
  try {
    font.encodeText(text)
    return text
  } catch {
    let safe = ''
    for (const character of text) {
      try {
        font.encodeText(character)
        safe += character
      } catch {
        safe += '?'
      }
    }
    return safe
  }
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function formatTimestamp(date: Date): string {
  return date.toISOString()
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * PdfExporter
 *
 * Responsibility: render an AnalysisReport snapshot to a PDF (UC4 export).
 *
 * Critical rules:
 * - Reads ONLY from the passed snapshot — no repository, no reader, no
 *   re-aggregation (§5.4: "renders from saved snapshot").
 * - Renders only the sections listed in snapshot.filters.includedSections
 *   (BR12).
 * - Labels come from domain/i18n.ts keyed by the requested language.
 * - A zero-activity snapshot (warningFlag) still exports a valid PDF (E1).
 */
export class PdfExporter {
  /**
   * Export a snapshot as a PDF.
   *
   * @param snapshot the frozen report to render
   * @param language label language (EN / SI / TA)
   * @returns the PDF bytes
   * @throws PdfExportError when rendering fails
   */
  async export(snapshot: AnalysisReport, language: Language): Promise<Uint8Array> {
    try {
      return await this.render(snapshot, language)
    } catch (error) {
      if (error instanceof PdfExportError) {
        throw error
      }
      throw new PdfExportError(snapshot.id, error instanceof Error ? error.message : String(error))
    }
  }

  private async render(snapshot: AnalysisReport, language: Language): Promise<Uint8Array> {
    // 1–3. Document, A4 portrait page, standard fonts.
    const doc = await PDFDocument.create()
    let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const bold = await doc.embedFont(StandardFonts.HelveticaBold)

    // 4. i18n labels.
    const labels = LABELS[language]

    // Drawing state: one cursor shared by every section; a new page is
    // started automatically when the cursor reaches the bottom margin.
    let y = PAGE_HEIGHT - MARGIN

    const draw = (text: string, options: { bold?: boolean; size?: number; gap?: number } = {}): void => {
      if (y < MARGIN) {
        page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
        y = PAGE_HEIGHT - MARGIN
      }
      const activeFont = options.bold ? bold : font
      page.drawText(sanitizeForFont(text, activeFont), {
        x: MARGIN,
        y,
        size: options.size ?? 11,
        font: activeFont,
      })
      y -= options.gap ?? LINE_HEIGHT
    }

    const { filters, metrics } = snapshot
    const included = new Set(filters.includedSections)

    // 5. Header: title, period, generated, source cutoff.
    draw(labels.title, { bold: true, size: 18, gap: 26 })
    draw(`${labels.period}: ${formatDate(filters.from)} - ${formatDate(filters.to)}`)
    draw(`${labels.generated}: ${formatTimestamp(snapshot.generatedAt)}`)
    draw(`${labels.sourceCutoff}: ${formatTimestamp(snapshot.sourceCutoff)}`, { gap: 22 })

    if (snapshot.warningFlag) {
      draw(labels.noActivity, { gap: 22 })
    }

    // 6. Sections — only those the official included (BR12).

    if (included.has('ALERTS')) {
      draw(labels.alerts, { bold: true, size: 14, gap: 20 })
      draw(`Total: ${metrics.alerts.total}`)
      for (const [severity, count] of Object.entries(metrics.alerts.bySeverity)) {
        draw(`  ${severity}: ${count}`)
      }
      for (const [hazardType, count] of Object.entries(metrics.alerts.byHazardType)) {
        draw(`  ${hazardType}: ${count}`)
      }
      y -= SECTION_GAP
    }

    if (included.has('REACH')) {
      draw(labels.reach, { bold: true, size: 14, gap: 20 })
      draw(`${labels.distinctCitizens}: ${metrics.reach.distinctCitizens}`)
      draw(labels.perChannel)
      // Attempted / Delivered / Failed have no i18n keys — see i18n.ts scope.
      for (const channel of ['PUSH', 'SMS'] as const) {
        const stats = metrics.reach.perChannel[channel]
        draw(
          `  ${channel}  Attempted: ${stats.attempted}  Delivered: ${stats.delivered}  Failed: ${stats.failed}`,
        )
      }
      y -= SECTION_GAP
    }

    if (included.has('REPORTS')) {
      draw(labels.reports, { bold: true, size: 14, gap: 20 })
      draw(`${labels.verified}: ${metrics.reports.verified}`)
      draw(`${labels.rejected}: ${metrics.reports.rejected}`)
      draw(`${labels.pending}: ${metrics.reports.pending}`)
      y -= SECTION_GAP
    }

    if (included.has('SHELTERS')) {
      draw(labels.shelters, { bold: true, size: 14, gap: 20 })
      draw(`Activated: ${metrics.shelters.activated}`)
      draw(`Peak Occupancy: ${metrics.shelters.peakOccupancy}`)
      y -= SECTION_GAP
    }

    if (included.has('SUPPLIES')) {
      draw(labels.supplies, { bold: true, size: 14, gap: 20 })
      for (const [supplyType, stats] of Object.entries(metrics.supplies.byType)) {
        // BR10: zero denominator → percent null → render "n/a".
        const percent = stats.percent !== null ? `${stats.percent}%` : 'n/a'
        draw(`  ${supplyType}  ${stats.distributed} / ${stats.total}  ${labels.percent}: ${percent}`)
      }
      y -= SECTION_GAP
    }

    // 7.
    return await doc.save()
  }
}
