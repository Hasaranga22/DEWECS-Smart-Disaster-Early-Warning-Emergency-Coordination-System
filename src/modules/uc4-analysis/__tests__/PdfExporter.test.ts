import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'

import type { AnalysisReport } from '../domain/AnalysisReport'
import { PdfExporter } from '../services/PdfExporter'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseFilters: AnalysisReport['filters'] = {
  from: new Date('2026-08-01T00:00:00.000Z'),
  to: new Date('2026-08-31T00:00:00.000Z'),
  districtId: '3f1d3e0a-8f5e-4a2b-9c7d-1e2f3a4b5c6d',
  hazardType: 'FLOOD',
  includedSections: ['ALERTS', 'REACH', 'REPORTS', 'SHELTERS', 'SUPPLIES'],
  language: 'EN',
}

const fullSnapshot: AnalysisReport = {
  id: 'report-full',
  filters: baseFilters,
  sourceCutoff: new Date('2026-09-01T00:00:00.000Z'),
  generatedAt: new Date('2026-09-02T10:23:00.000Z'),
  generatedBy: 'officer-001',
  metrics: {
    alerts: {
      total: 6,
      bySeverity: { ADVISORY: 2, WATCH: 1, WARNING: 2, EMERGENCY: 1 },
      byHazardType: { FLOOD: 6 },
    },
    reach: {
      distinctCitizens: 18214,
      perChannel: {
        PUSH: { attempted: 18000, delivered: 17500, failed: 500 },
        SMS: { attempted: 18000, delivered: 15200, failed: 2800 },
      },
    },
    reports: { verified: 42, rejected: 3, pending: 6 },
    shelters: {
      activated: 5,
      peakOccupancy: 120,
      events: [
        {
          occurredAt: new Date('2026-08-03T08:00:00.000Z'),
          shelterId: 'shelter-1',
          previousCount: 0,
          newCount: 120,
        },
      ],
    },
    supplies: {
      byType: {
        FOOD: { distributed: 8200, total: 10000, percent: 82 },
        WATER: { distributed: 5500, total: 5500, percent: 100 },
      },
    },
  },
  warningFlag: false,
}

const alertOnlySnapshot: AnalysisReport = {
  ...fullSnapshot,
  id: 'report-alerts-only',
  filters: { ...baseFilters, includedSections: ['ALERTS'] },
}

const emptySnapshot: AnalysisReport = {
  ...fullSnapshot,
  id: 'report-empty',
  metrics: {
    alerts: { total: 0, bySeverity: {}, byHazardType: {} },
    reach: {
      distinctCitizens: 0,
      perChannel: {
        PUSH: { attempted: 0, delivered: 0, failed: 0 },
        SMS: { attempted: 0, delivered: 0, failed: 0 },
      },
    },
    reports: { verified: 0, rejected: 0, pending: 0 },
    shelters: { activated: 0, peakOccupancy: 0, events: [] },
    supplies: { byType: {} },
  },
  warningFlag: true,
}

const nullPercentSnapshot: AnalysisReport = {
  ...fullSnapshot,
  id: 'report-null-percent',
  filters: { ...baseFilters, includedSections: ['SUPPLIES'] },
  metrics: {
    ...fullSnapshot.metrics,
    supplies: { byType: { FOOD: { distributed: 0, total: 0, percent: null } } },
  },
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PdfExporter', () => {
  const exporter = new PdfExporter()

  it('A11.a: full snapshot → PDF has >= 1 page', async () => {
    const bytes = await exporter.export(fullSnapshot, 'EN')

    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1)
  })

  it("A11.b: includedSections: ['ALERTS'] → PDF valid, no crash", async () => {
    const bytes = await exporter.export(alertOnlySnapshot, 'EN')

    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1)
  })

  it('A11.c: empty snapshot (warningFlag=true, all metrics zero) → still valid PDF', async () => {
    const bytes = await exporter.export(emptySnapshot, 'EN')

    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1)
  })

  it('A11.d: percent === null case (zero-total supplies) → PDF valid, no crash', async () => {
    const bytes = await exporter.export(nullPercentSnapshot, 'EN')

    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1)
  })

  it('A11.e: Sinhala labels (language SI) export without crash (WinAnsi fallback)', async () => {
    // Helvetica only encodes WinAnsi — non-Latin labels must not kill the export.
    const bytes = await exporter.export(fullSnapshot, 'SI')

    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1)
  })
})
