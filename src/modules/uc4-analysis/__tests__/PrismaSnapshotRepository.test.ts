import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/prisma/client', () => ({
  prisma: {
    officer: { findUnique: vi.fn() },
    analysisReport: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
  },
}))

import { prisma } from '@/shared/infra/prisma/client'

import { PrismaSnapshotRepository } from '../adapters/prisma/PrismaSnapshotRepository'
import type { AnalysisReport } from '../domain/AnalysisReport'

/** Seeded "System Analysis Fallback Officer" (prisma/seed.ts). */
const FALLBACK_OFFICER_ID = '6b3f23e5-f18b-485f-8ba6-b3147f31fbfa'
/** DEMO_ACTORS[DMC_OFFICIAL].id — in demo id space, NOT in the Officer table. */
const DEMO_DMC_ID = '00000000-0004-4000-8000-000000000002'

function makeReport(generatedBy: string): AnalysisReport {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    filters: {
      from: new Date('2026-08-01T00:00:00.000Z'),
      to: new Date('2026-08-31T23:59:59.999Z'),
      includedSections: ['ALERTS', 'REACH'],
      language: 'EN',
    },
    sourceCutoff: new Date('2026-09-01T00:00:00.000Z'),
    generatedAt: new Date('2026-09-02T10:00:00.000Z'),
    generatedBy,
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
}

describe('PrismaSnapshotRepository.save generatedBy Officer FK', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.analysisReport.create).mockResolvedValue({} as never)
  })

  it('substitutes the fallback officer when the actor id has no Officer row', async () => {
    vi.mocked(prisma.officer.findUnique).mockResolvedValue(null)

    await new PrismaSnapshotRepository().save(makeReport(DEMO_DMC_ID))

    expect(prisma.officer.findUnique).toHaveBeenCalledWith({
      where: { id: DEMO_DMC_ID },
      select: { id: true },
    })
    const data = vi.mocked(prisma.analysisReport.create).mock.calls[0][0].data
    expect(data.generatedBy).toBe(FALLBACK_OFFICER_ID)
  })

  it('keeps generatedBy when the Officer row exists', async () => {
    vi.mocked(prisma.officer.findUnique).mockResolvedValue({ id: DEMO_DMC_ID } as never)

    await new PrismaSnapshotRepository().save(makeReport(DEMO_DMC_ID))

    const data = vi.mocked(prisma.analysisReport.create).mock.calls[0][0].data
    expect(data.generatedBy).toBe(DEMO_DMC_ID)
  })
})
