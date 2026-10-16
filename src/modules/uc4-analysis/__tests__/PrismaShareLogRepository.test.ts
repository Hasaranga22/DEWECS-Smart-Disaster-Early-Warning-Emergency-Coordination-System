import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/prisma/client', () => ({
  prisma: {
    officer: { findUnique: vi.fn() },
    reportShare: { create: vi.fn(), findMany: vi.fn() },
  },
}))

import { prisma } from '@/shared/infra/prisma/client'

import { PrismaShareLogRepository } from '../adapters/prisma/PrismaShareLogRepository'
import type { ReportShare } from '../domain/ReportShare'

/** Seeded "DMC Official" — the repository's actor fallback (prisma/seed.ts). */
const FALLBACK_ACTOR_ID = '00000000-0000-4000-8000-000000000888'
/** DEMO_ACTORS[DMC_OFFICIAL].id — demo id space, no Officer row. */
const DEMO_DMC_ID = '00000000-0004-4000-8000-000000000002'

function makeShare(actorId: string): ReportShare {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    reportId: '11111111-1111-4111-8111-111111111111',
    organizationId: '75700352-5645-41a3-acc7-c8184f09cf35',
    status: 'SENT',
    attemptedAt: new Date('2026-09-01T00:00:00.000Z'),
    actorId,
  }
}

describe('PrismaShareLogRepository.save actorId Officer FK', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.reportShare.create).mockResolvedValue({} as never)
  })

  it('substitutes the seeded DMC fallback when the actor id has no Officer row', async () => {
    vi.mocked(prisma.officer.findUnique).mockResolvedValue(null)

    await new PrismaShareLogRepository().save(makeShare(DEMO_DMC_ID))

    expect(prisma.officer.findUnique).toHaveBeenCalledWith({
      where: { id: DEMO_DMC_ID },
      select: { id: true },
    })
    const data = vi.mocked(prisma.reportShare.create).mock.calls[0][0].data
    expect(data.actorId).toBe(FALLBACK_ACTOR_ID)
  })

  it('keeps actorId when the Officer row exists', async () => {
    vi.mocked(prisma.officer.findUnique).mockResolvedValue({ id: DEMO_DMC_ID } as never)

    await new PrismaShareLogRepository().save(makeShare(DEMO_DMC_ID))

    const data = vi.mocked(prisma.reportShare.create).mock.calls[0][0].data
    expect(data.actorId).toBe(DEMO_DMC_ID)
  })

  it('keeps the existing non-UUID fallback (no query with a non-uuid value)', async () => {
    vi.mocked(prisma.officer.findUnique).mockResolvedValue({ id: FALLBACK_ACTOR_ID } as never)

    await new PrismaShareLogRepository().save(makeShare('officer-1'))

    expect(prisma.officer.findUnique).toHaveBeenCalledWith({
      where: { id: FALLBACK_ACTOR_ID },
      select: { id: true },
    })
    const data = vi.mocked(prisma.reportShare.create).mock.calls[0][0].data
    expect(data.actorId).toBe(FALLBACK_ACTOR_ID)
  })
})
