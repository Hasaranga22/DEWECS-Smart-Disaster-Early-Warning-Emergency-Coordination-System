import type { Uc1Module } from '@/modules/uc1-warning'
import type { Uc2Module } from '@/modules/uc2-report'
import type { SupplyStockRepository } from '@/modules/uc3-resources/adapters/repositories/SupplyStockRepository'
import type { Uc3Module } from '@/modules/uc3-resources'
import type { Uc4Module } from '@/modules/uc4-analysis'
import type { AnalysisReport } from '@/modules/uc4-analysis/domain/AnalysisReport'
import type { ShareOutcome } from '@/modules/uc4-analysis/domain/ShareOutcome'
import { DEMO_ACTORS } from '@/shared/access/actors'
import type { Clock } from '@/shared/contracts/Clock'

import { KELANI_BASIN_ID } from './basins'
import { D } from './districts'
import { ORGANIZATIONS } from './organizations'

// ─── Errors ───────────────────────────────────────────────────────────────────

/** Typed failure for demo/story verification — never a bare `new Error`. */
export class DemoScenarioError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DemoScenarioError'
  }
}

// ─── Contract ─────────────────────────────────────────────────────────────────

/**
 * Everything `runDemoScenario` needs: the real module singletons plus the two
 * reads the story performs on container state (eligible stock). Callers pass
 * the shared container (`import { container } from '@/shared/infra/container'`).
 */
export interface DemoContainer {
  uc1: Uc1Module
  uc2: Uc2Module
  uc3: Uc3Module
  uc4: Uc4Module
  prodClock: Clock
  stockRepo: SupplyStockRepository
}

/** What the story produced — returned so callers/tests can assert on it. */
export interface DemoResult {
  groundReportId: string
  alertId: string
  shelterId: string
  analysis: AnalysisReport
  shareOutcomes: ShareOutcome[]
  retryOutcomes: ShareOutcome[]
}

/** Stable ids of the three partner organisations seeded in the container. */
const PARTNER_ORG_IDS = [
  '00000000-0000-4000-8000-000000000200',
  '00000000-0000-4000-8000-000000000300',
  '00000000-0000-4000-8000-000000000400',
]

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Colombo's id in the container's seeded UC3 demo namespace (the
 * `buildUc3Seed` call in container.ts) — seeded shelters/teams/stocks all
 * live under these ids, so UC3 steps use them (and a matching district
 * officer) to satisfy ResourceAccessPolicy's district-boundary rule.
 */
const DEMO_COLOMBO = '00000000-0000-4000-8000-000000000010'

// ─── Story ────────────────────────────────────────────────────────────────────

/**
 * runDemoScenario — the Kelani River Basin flood story (docs/uc4-context.md
 * §13), executed through the REAL services of every module: UC2 submit &
 * verify -> UC1 issue flood warning -> UC3 register shelter, activate it,
 * dispatch a team, log supply distributions -> UC4 generate the analysis
 * snapshot, verify its KPIs, and share it with 3 partner organisations
 * (retrying failures once).
 *
 * Assumes a fresh in-memory store (one run per process start) — dispatch
 * auto-picks the first AVAILABLE home team, which a second run may no longer
 * find.
 *
 * @param container the shared container (`{ uc1, uc2, uc3, uc4, prodClock, stockRepo }`)
 * @returns the ids and artifacts the story produced
 * @throws DemoScenarioError when KPI verification fails or a prerequisite is missing
 */
export async function runDemoScenario(container: DemoContainer): Promise<DemoResult> {
  const { uc1, uc2, uc3, uc4, prodClock, stockRepo } = container
  const citizen = DEMO_ACTORS.CITIZEN
  const dutyOfficer = DEMO_ACTORS.DUTY_OFFICER
  const dmcOfficial = DEMO_ACTORS.DMC_OFFICIAL
  const districtOfficer = { ...DEMO_ACTORS.DISTRICT_OFFICER, districtId: DEMO_COLOMBO }

  // 1. UC2: citizen submits a ground report, duty officer verifies it.
  const submitted = await uc2.submissionService.submit(
    {
      reporterId: citizen.id,
      districtId: D.COLOMBO,
      hazardType: 'FLOOD',
      description: 'Water rising rapidly near the Kelani river bank in Kelaniya.',
      latitude: 6.9271,
      longitude: 79.8612,
      locationSource: 'GPS',
      gpsAccuracyM: 8,
      localId: 'demo-uc2-report-1',
      captureTime: prodClock.now(),
    },
    true,
  )
  if (submitted.channel !== 'online') {
    throw new DemoScenarioError('UC2 submission unexpectedly went to the offline outbox')
  }
  const groundReport = submitted.report
  await uc2.reviewService.verify({
    reportId: groundReport.id,
    expectedVersion: groundReport.version,
    officerId: dutyOfficer.id,
    severityIndication: 'HIGH',
  })

  // 2. UC1: DMC Official issues the flood warning for the Kelani basin.
  const warning = await uc1.warningService.issue({
    title: 'Kelani River Flood Warning',
    hazardType: 'FLOOD',
    severity: 'WARNING',
    message: 'Flood warning: Kelani basin river levels are rising. Move to higher ground.',
    target: { basinId: KELANI_BASIN_ID },
    issuedBy: dmcOfficial.id,
  })

  // 3. UC3: District Officer registers + activates a shelter, dispatches a
  // team, and logs two supply distributions (200 + 100 units).
  const shelter = await uc3.shelters.registerShelter({
    actor: districtOfficer,
    districtId: DEMO_COLOMBO,
    organizationId: ORGANIZATIONS[2].id,
    name: 'Kelani Flood Relief Center',
    address: 'River Road, Kelaniya',
    capacity: 250,
  })
  await uc3.shelters.updateOccupancy({
    actionId: 'demo-occupancy-1',
    actor: districtOfficer,
    shelterId: shelter.id,
    expectedVersion: shelter.version,
    newCount: 120,
  })
  await uc3.dispatch.dispatch({
    actionId: 'demo-dispatch-1',
    actor: districtOfficer,
    destinationDistrictId: DEMO_COLOMBO,
    incident: 'Kelani basin flooding',
    location: 'Kelaniya river bank',
  })

  const stock = (await stockRepo.findAll()).find(
    (s) => s.districtId === DEMO_COLOMBO && s.onHand >= 300,
  )
  if (!stock) {
    throw new DemoScenarioError('No Colombo stock with onHand >= 300 available for demo distributions')
  }
  await uc3.distributions.distribute({
    actionId: 'demo-distribution-1',
    actor: districtOfficer,
    stockId: stock.id,
    destinationShelterId: shelter.id,
    quantity: 200,
  })
  await uc3.distributions.distribute({
    actionId: 'demo-distribution-2',
    actor: districtOfficer,
    stockId: stock.id,
    destinationShelterId: shelter.id,
    quantity: 100,
  })

  // 4. UC4: DMC Official generates the snapshot over a window that covers
  // everything the story just wrote (this run's timestamps).
  const windowEnd = prodClock.now()
  const windowStart = new Date(windowEnd.getTime() - 30 * MS_PER_DAY)
  const windowAfter = new Date(windowEnd.getTime() + MS_PER_DAY)
  const analysis = await uc4.snapshotService.generate(
    {
      from: windowStart.toISOString().slice(0, 10),
      to: windowAfter.toISOString().slice(0, 10),
      hazardType: 'FLOOD',
      includedSections: ['ALERTS', 'REACH', 'REPORTS', 'SHELTERS', 'SUPPLIES'],
      language: 'EN',
    },
    dmcOfficial,
  )

  // 5. Verify the KPIs (tolerant lower bounds so a second demo run in the
  // same process still verifies — exact values are asserted by the tests).
  verifyDemoKpis(analysis)

  // 6. Share with 3 partners; retry each FAILED partner exactly once
  // (BR8: every attempt appends its own share-log row).
  const shareOutcomes = await uc4.shareService.share(analysis.id, PARTNER_ORG_IDS, dmcOfficial)
  const failedOrgIds = [
    ...new Set(
      shareOutcomes.filter((o) => o.status === 'FAILED').map((o) => o.organizationId),
    ),
  ]
  const retryOutcomes =
    failedOrgIds.length > 0
      ? await uc4.shareService.share(analysis.id, failedOrgIds, dmcOfficial)
      : []

  return {
    groundReportId: groundReport.id,
    alertId: warning.alert.id,
    shelterId: shelter.id,
    analysis,
    shareOutcomes,
    retryOutcomes,
  }
}

// ─── KPI verification ─────────────────────────────────────────────────────────

/**
 * Verify the demo KPIs documented in docs/uc4-context.md §13 (steps 5).
 *
 * @param analysis the snapshot generated by the story
 * @throws DemoScenarioError listing every KPI that failed
 */
export function verifyDemoKpis(analysis: AnalysisReport): void {
  const m = analysis.metrics
  const problems: string[] = []

  if (!(m.alerts.total >= 1)) problems.push(`alerts.total=${m.alerts.total} (expected >= 1)`)
  if (!(m.reach.distinctCitizens > 0)) {
    problems.push(`reach.distinctCitizens=${m.reach.distinctCitizens} (expected > 0)`)
  }
  if (!(m.reports.verified >= 1)) problems.push(`reports.verified=${m.reports.verified} (expected >= 1)`)
  if (!(m.shelters.activated >= 1)) {
    problems.push(`shelters.activated=${m.shelters.activated} (expected >= 1)`)
  }
  if (!(m.shelters.peakOccupancy > 0)) {
    problems.push(`shelters.peakOccupancy=${m.shelters.peakOccupancy} (expected > 0)`)
  }
  if (Object.keys(m.supplies.byType).length === 0) {
    problems.push('supplies.byType is empty (expected at least one distributed type)')
  }

  if (problems.length > 0) {
    throw new DemoScenarioError(`Demo KPI verification failed: ${problems.join('; ')}`)
  }
}
