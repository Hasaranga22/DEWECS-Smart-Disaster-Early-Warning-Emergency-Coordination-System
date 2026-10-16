import { describe, expect, it } from 'vitest'

import { getUc1Module } from '@/modules/uc1-warning/container'
import { HazardAlert, NotificationAttempt } from '@/modules/uc1-warning/domain'
import { Distribution } from '@/modules/uc3-resources/domain/entities/Distribution'
import { OccupancyEvent } from '@/modules/uc3-resources/domain/entities/OccupancyEvent'
import { SupplyStock } from '@/modules/uc3-resources/domain/entities/SupplyStock'
import type { Actor } from '@/shared/contracts/types'
import {
  audits,
  distributionRepo,
  occupancyEventRepo,
  stockRepo,
  uc4,
} from '@/shared/infra/container'

// A10-c Task 5: in DATA_STORE=memory the UC4 readers must read LIVE from the
// UC1/UC2/UC3 in-memory stores — writing through one module's repository has
// to show up in the next report generate() without any manual reader seeding.

const dmc: Actor = { id: 'officer-001', role: 'DMC_OFFICIAL' }
const COLOMBO = '00000000-0000-4000-8000-000000000010'
const occurredAt = new Date('2026-08-15T06:00:00.000Z')

describe('memory-mode container wiring (Task 5)', () => {
  it('generate() returns non-zero metrics from live UC1/UC2/UC3 data', async () => {
    // UC1: a warning was issued and delivered.
    const uc1 = getUc1Module()
    await uc1.alertRepo.save(
      new HazardAlert({
        id: 'alert-wired-1',
        hazardType: 'FLOOD',
        severity: 'WARNING',
        message: 'Kelani basin flooding',
        target: { districtIds: [COLOMBO] },
        issuedBy: dmc.id,
        occurredAt,
      }),
    )
    await uc1.alertRepo.saveAttempt(
      new NotificationAttempt({
        id: 'attempt-wired-1',
        alertId: 'alert-wired-1',
        citizenId: 'citizen-wired-1',
        districtId: COLOMBO,
        hazardType: 'FLOOD',
        channel: 'SMS',
        status: 'DELIVERED',
        kind: 'ISSUE',
        occurredAt,
        sentAt: occurredAt,
        deliveredAt: occurredAt,
      }),
    )

    // UC2: one ground report review decision.
    await audits.save({
      id: 'audit-wired-1',
      reportId: 'report-wired-1',
      action: 'VERIFIED',
      occurredAt,
      districtId: COLOMBO,
      hazardType: 'FLOOD',
    })

    // UC3: shelter occupancy event, a stock row, and a distribution of it.
    await occupancyEventRepo.save(
      new OccupancyEvent({
        id: 'occ-wired-1',
        shelterId: 'shelter-wired-1',
        districtId: COLOMBO,
        previousCount: 10,
        newCount: 42,
        actorId: dmc.id,
        occurredAt,
        actionId: 'action-wired-1',
      }),
    )
    await stockRepo.save(
      new SupplyStock({
        id: 'stock-wired-1',
        organizationId: '00000000-0000-4000-8000-000000000100',
        districtId: COLOMBO,
        supplyType: 'WATER_WIRING_CHECK',
        onHand: 100,
      }),
    )
    await distributionRepo.save(
      new Distribution({
        id: 'dist-wired-1',
        stockId: 'stock-wired-1',
        destinationShelterId: 'shelter-wired-1',
        organizationId: '00000000-0000-4000-8000-000000000100',
        districtId: COLOMBO,
        quantity: 10,
        actorId: dmc.id,
        occurredAt,
        actionId: 'action-wired-2',
      }),
    )

    const report = await uc4.snapshotService.generate(
      {
        from: '2026-08-01',
        to: '2026-08-31',
        districtId: COLOMBO,
        hazardType: 'FLOOD',
        includedSections: ['ALERTS', 'REACH', 'REPORTS', 'SHELTERS', 'SUPPLIES'],
        language: 'EN',
      },
      dmc,
    )

    expect(report.metrics.alerts.total).toBeGreaterThan(0)
    expect(report.metrics.alerts.byHazardType.FLOOD).toBeGreaterThan(0)
    expect(report.metrics.reach.distinctCitizens).toBe(1)
    expect(report.metrics.reach.perChannel.SMS.delivered).toBeGreaterThan(0)
    expect(report.metrics.reports.verified).toBe(1)
    expect(report.metrics.shelters.activated).toBe(1)
    expect(report.metrics.shelters.peakOccupancy).toBe(42)
    expect(report.metrics.supplies.byType['WATER_WIRING_CHECK']).toEqual({
      distributed: 10,
      total: 100,
      percent: 10,
    })
  })
})
