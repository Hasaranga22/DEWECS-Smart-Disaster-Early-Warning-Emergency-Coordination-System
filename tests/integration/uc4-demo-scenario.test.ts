import { describe, expect, it } from 'vitest'

import { container } from '@/shared/infra/container'
import { runDemoScenario } from '@/shared/seed/demoScenario'

// A10 Task 6: the Kelani flood story must run through the REAL services of
// UC2 -> UC1 -> UC3 -> UC4 (README §5: "demoScenario.ts loads through the
// real services, not by writing rows directly").

describe('demoScenario (Kelani flood story)', () => {
  it('runs UC2 -> UC1 -> UC3 -> UC4 end to end and produces the documented KPIs', async () => {
    const result = await runDemoScenario(container)

    // 1-2. UC2: citizen report submitted + duty officer verified.
    expect(result.groundReportId).toBeTruthy()
    // 3. UC1: warning issued for the Kelani basin.
    expect(result.alertId).toBeTruthy()

    // 4. UC4: snapshot generated inside the scenario window.
    const { metrics } = result.analysis
    expect(metrics.alerts.total).toBe(1)
    expect(metrics.alerts.bySeverity.WARNING).toBe(1)
    expect(metrics.alerts.byHazardType.FLOOD).toBe(1)

    // Reach: >=15 recipients (Kelani districts) attempted, at least one delivered.
    expect(
      metrics.reach.perChannel.SMS.attempted + metrics.reach.perChannel.PUSH.attempted,
    ).toBeGreaterThanOrEqual(15)
    expect(metrics.reach.distinctCitizens).toBeGreaterThan(0)

    // Reports: the one VERIFIED ground report.
    expect(metrics.reports.verified).toBe(1)
    expect(metrics.reports.rejected).toBe(0)
    expect(metrics.reports.pending).toBe(0)

    // Shelters: the registered demo shelter became active (occupancy event).
    expect(metrics.shelters.activated).toBe(1)
    expect(metrics.shelters.peakOccupancy).toBe(120)
    expect(metrics.shelters.events).toHaveLength(1)

    // Supplies: 200 + 100 units of the first eligible Colombo stock (Food Rations).
    expect(metrics.supplies.byType['Food Rations (Packs)']).toEqual({
      distributed: 300,
      total: 1200, // 1500 seeded onHand - 300 distributed by the demo
      percent: 25,
    })

    // 5. KPI verification passed inside runDemoScenario (no throw above).

    // 6. Shared with 3 partners; failures (if any) retried once and appended.
    expect(result.shareOutcomes).toHaveLength(3)
    expect(
      result.shareOutcomes.every((o) => o.status === 'SENT' || o.status === 'FAILED'),
    ).toBe(true)
    expect(result.retryOutcomes).toHaveLength(
      new Set(
        result.shareOutcomes.filter((o) => o.status === 'FAILED').map((o) => o.organizationId),
      ).size,
    )

    const shareRows = await container.uc4.shareLogRepository.listByReport(result.analysis.id)
    expect(shareRows).toHaveLength(3 + result.retryOutcomes.length)

    // The snapshot is retrievable after sharing.
    const refetched = await container.uc4.snapshotRepository.getById(result.analysis.id)
    expect(refetched).not.toBeNull()
    expect(refetched?.metrics.alerts.total).toBe(1)
  })
})
