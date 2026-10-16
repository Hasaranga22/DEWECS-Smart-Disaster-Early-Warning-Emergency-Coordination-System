import 'dotenv/config'
import { spawnSync } from 'node:child_process'

import { container, prodClock } from '@/shared/infra/container'
import { prisma } from '@/shared/infra/prisma/client'
import { hydrateIncompleteSnapshot } from '@/modules/uc4-analysis/seed/ensureUc4SampleData'

// ─── Sample report identity ──────────────────────────────────────────────────

const SAMPLE_DMC_ID = '00000000-0004-4000-8000-000000000801'

const KEGALLE = '00000000-0000-4000-8000-000000000001'
const GAMPAHA = '00000000-0000-4000-8000-000000000002'
const COLOMBO = '00000000-0000-4000-8000-000000000010'

const ORG_ARMY = '75700352-5645-41a3-acc7-c8184f09cf35'
const ORG_WV = '9c343cb9-c47a-4a05-bb4d-be2641a933b4'
const ORG_DONOR = '656c8a22-e60d-4e32-bfb5-8c5ed132d882'

const TIMEOUT_REASON = 'Partner gateway timeout - retry or use email fallback'

type ChannelStats = { attempted: number; delivered: number; failed: number }

interface ExpectedReport {
  label: string
  filters: {
    from: string
    to: string
    districtId?: string
    hazardType?: string
    includedSections: string[]
    language: string
  }
  warningFlag: boolean
  alerts: { total: number; bySeverity: Record<string, number>; byHazardType: Record<string, number> }
  reach: { distinctCitizens: number; perChannel: { PUSH: ChannelStats; SMS: ChannelStats } }
  reports: { verified: number; pending: number; rejected: number }
  shelters?: { activated: number; peakOccupancy: number; eventTimes: string[] }
  /**
   * Bridge-synthesized shelters (no real occupancy events in-window): teammate
   * shelter rows in the district may come and go, so assert floors plus the
   * strict "2 events per activated shelter" relation instead of exact times.
   */
  sheltersMin?: { activated: number; peakOccupancy: number }
  supplies: Record<string, { distributed: number; total: number; percent: number | null }>
  shares: Array<{ organizationName: string; status: string; failureReason?: string }>
}

const ALL_SECTIONS = ['ALERTS', 'REACH', 'REPORTS', 'SHELTERS', 'SUPPLIES']

const REACH_KEGALLE = {
  distinctCitizens: 1000,
  perChannel: {
    PUSH: { attempted: 1000, delivered: 950, failed: 50 },
    SMS: { attempted: 1000, delivered: 900, failed: 100 },
  },
}

const SUPPLIES_KEGALLE = {
  FOOD: { distributed: 5000, total: 10000, percent: 50 },
  WATER: { distributed: 5500, total: 5500, percent: 100 },
  MEDICINE: { distributed: 640, total: 800, percent: 80 },
  SHELTER_MATERIAL: { distributed: 210, total: 300, percent: 70 },
}

const EXPECTED: ExpectedReport[] = [
  {
    // #1 Kegalle, all hazards, Aug 2026, EN — shared to all 3 partners (2 SENT + 1 FAILED + 1 retry SENT)
    label: '#1 Kegalle ALL Aug EN (all sections, 3-partner share + retry)',
    filters: {
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-08-31T23:59:59.000Z',
      districtId: KEGALLE,
      includedSections: ALL_SECTIONS,
      language: 'EN',
    },
    warningFlag: false,
    alerts: { total: 2, bySeverity: { WARNING: 1, WATCH: 1 }, byHazardType: { FLOOD: 1, LANDSLIDE: 1 } },
    reach: REACH_KEGALLE,
    reports: { verified: 42, pending: 6, rejected: 3 },
    shelters: {
      activated: 2,
      peakOccupancy: 420,
      eventTimes: ['2026-08-16T10:00:00.000Z', '2026-08-17T10:00:00.000Z'],
    },
    supplies: SUPPLIES_KEGALLE,
    shares: [
      { organizationName: 'Sample Sri Lanka Army', status: 'SENT' },
      { organizationName: 'Sample World Vision Lanka', status: 'FAILED', failureReason: TIMEOUT_REASON },
      { organizationName: 'Sample Private Donor', status: 'SENT' },
      { organizationName: 'Sample World Vision Lanka', status: 'SENT' },
    ],
  },
  {
    // #2 Kegalle, FLOOD only, Aug 2026, EN — same source rows, hazard-filtered tallies
    label: '#2 Kegalle FLOOD Aug EN (hazard-scoped tallies)',
    filters: {
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-08-31T23:59:59.000Z',
      districtId: KEGALLE,
      hazardType: 'FLOOD',
      includedSections: ALL_SECTIONS,
      language: 'EN',
    },
    warningFlag: false,
    alerts: { total: 1, bySeverity: { WARNING: 1 }, byHazardType: { FLOOD: 1 } },
    reach: REACH_KEGALLE,
    reports: { verified: 32, pending: 5, rejected: 2 },
    shelters: {
      activated: 2,
      peakOccupancy: 420,
      eventTimes: ['2026-08-16T10:00:00.000Z', '2026-08-17T10:00:00.000Z'],
    },
    supplies: SUPPLIES_KEGALLE,
    shares: [],
  },
  {
    // #3 All districts, all hazards, Aug 2026, SI — ALERTS/REACH/SUPPLIES only
    label: '#3 ALL districts Aug SI (3 sections, peak 420 / 5 activated)',
    filters: {
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-08-31T23:59:59.000Z',
      includedSections: ['ALERTS', 'REACH', 'SUPPLIES'],
      language: 'SI',
    },
    warningFlag: false,
    alerts: {
      total: 3,
      bySeverity: { WARNING: 1, WATCH: 1, EMERGENCY: 1 },
      byHazardType: { FLOOD: 1, LANDSLIDE: 1, CYCLONE: 1 },
    },
    reach: REACH_KEGALLE,
    reports: { verified: 42, pending: 6, rejected: 3 },
    shelters: {
      activated: 5,
      peakOccupancy: 420,
      eventTimes: [
        '2026-08-16T10:00:00.000Z',
        '2026-08-17T10:00:00.000Z',
        '2026-08-25T10:00:00.000Z',
        '2026-08-26T10:00:00.000Z',
        '2026-08-28T10:00:00.000Z',
      ],
    },
    supplies: SUPPLIES_KEGALLE,
    shares: [],
  },
  {
    // #4 Gampaha, FLOOD, Sep 2026, TA — shared to the Army partner (SENT)
    label: '#4 Gampaha FLOOD Sep TA (share → SENT)',
    filters: {
      from: '2026-09-01T00:00:00.000Z',
      to: '2026-09-30T23:59:59.000Z',
      districtId: GAMPAHA,
      hazardType: 'FLOOD',
      includedSections: ALL_SECTIONS,
      language: 'TA',
    },
    warningFlag: false,
    alerts: { total: 1, bySeverity: { WATCH: 1 }, byHazardType: { FLOOD: 1 } },
    reach: {
      distinctCitizens: 150,
      perChannel: {
        PUSH: { attempted: 150, delivered: 150, failed: 0 },
        SMS: { attempted: 50, delivered: 50, failed: 0 },
      },
    },
    reports: { verified: 0, pending: 0, rejected: 0 },
    // Sep has no real Gampaha occupancy events: the reader bridge synthesizes
    // 0→60%→occupancy steps from every occupied Gampaha shelter (seeded + teammate rows).
    sheltersMin: { activated: 1, peakOccupancy: 20 },
    supplies: {},
    shares: [{ organizationName: 'Sample Sri Lanka Army', status: 'SENT' }],
  },
  {
    // #5 Colombo, Jan 2026, EN — zero activity → warning flag (E1/BR7)
    label: '#5 Colombo Jan 2026 EN (zero activity → warningFlag)',
    filters: {
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-31T23:59:59.000Z',
      districtId: COLOMBO,
      includedSections: ALL_SECTIONS,
      language: 'EN',
    },
    warningFlag: true,
    alerts: { total: 0, bySeverity: {}, byHazardType: {} },
    reach: {
      distinctCitizens: 0,
      perChannel: {
        PUSH: { attempted: 0, delivered: 0, failed: 0 },
        SMS: { attempted: 0, delivered: 0, failed: 0 },
      },
    },
    reports: { verified: 0, pending: 0, rejected: 0 },
    shelters: { activated: 0, peakOccupancy: 0, eventTimes: [] },
    supplies: {},
    shares: [],
  },
]

// ─── Assertion helpers ────────────────────────────────────────────────────────

const failures: string[] = []

function check(label: string, actual: unknown, expected: unknown): void {
  if (!deepEqual(actual, expected)) {
    failures.push(`${label}: expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`)
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ak = Object.keys(a as object)
  const bk = Object.keys(b as object)
  if (ak.length !== bk.length) return false
  return ak.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}

function signatureOf(filters: Record<string, unknown>): string {
  return `${String(filters.districtId ?? 'ALL')}|${String(filters.hazardType ?? 'ALL')}|${String(filters.from)}`
}

function pad(value: string, width: number): string {
  return value.length >= width ? value.slice(0, width) : value + ' '.repeat(width - value.length)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('')
  console.log('  UC4  Sample Report Verification')
  console.log('')

  const reports = await prisma.analysisReport.findMany({
    where: { generatedBy: SAMPLE_DMC_ID },
    orderBy: { generatedAt: 'asc' },
  })

  // RED gate: the seed must have produced at least the 5 sample reports.
  if (reports.length < 5) {
    console.error(` FAIL: expected >= 5 sample reports, found ${reports.length}.`)
    console.error('        Run `npx tsx scripts/uc4-seed-sample-data.ts` first.')
    process.exit(1)
  }

  const reportIds = reports.map((r) => r.id)
  const shares = await prisma.reportShare.findMany({
    where: { reportId: { in: reportIds } },
    include: { organization: { select: { name: true } } },
    orderBy: [{ attemptedAt: 'asc' }, { id: 'asc' }],
  })
  const sharesByReport = new Map<string, Array<{ organizationName: string; status: string; failureReason?: string }>>()
  for (const share of shares) {
    const list = sharesByReport.get(share.reportId) ?? []
    list.push({
      organizationName: share.organization.name,
      status: share.status,
      ...(share.failureReason !== null ? { failureReason: share.failureReason } : {}),
    })
    sharesByReport.set(share.reportId, list)
  }

  const expectedByKey = new Map(EXPECTED.map((e) => [signatureOf(e.filters), e]))
  const seenKeys = new Set<string>()

  // ── Hydration gate (zero-KPI self-heal), run BEFORE the report loop: ──────
  // blank #2's stored metrics, hydrate, expect KPIs recomputed at the report's
  // own cutoff and persisted with the warning cleared. Refreshes the snapshot
  // afterwards, so a prior failed run that left #2 zeroed self-heals here.
  const hydrateTargetIndex = reports.findIndex(
    (r) => signatureOf(r.filters as Record<string, unknown>) === signatureOf(EXPECTED[1].filters),
  )
  if (hydrateTargetIndex < 0) {
    failures.push('hydrate gate: sample report #2 not found')
  } else {
    const hydrateTarget = reports[hydrateTargetIndex]
    const blanked = JSON.parse(JSON.stringify(hydrateTarget.metrics))
    blanked.alerts = { total: 0, bySeverity: {}, byHazardType: {} }
    blanked.reach = {
      distinctCitizens: 0,
      perChannel: { PUSH: { attempted: 0, delivered: 0, failed: 0 }, SMS: { attempted: 0, delivered: 0, failed: 0 } },
    }
    blanked.reports = { verified: 0, pending: 0, rejected: 0 }
    blanked.shelters = { activated: 0, peakOccupancy: 0, events: [] }
    blanked.supplies = { byType: {} }
    await prisma.analysisReport.update({
      where: { id: hydrateTarget.id },
      data: { metrics: blanked, warningFlag: true },
    })
    const stored = await container.uc4.snapshotRepository.getById(hydrateTarget.id)
    const hydrated =
      stored === null ? null : await hydrateIncompleteSnapshot(stored, container.uc4.aggregation)
    check('hydrate :: recomputed alerts', hydrated?.metrics.alerts, EXPECTED[1].alerts)
    check('hydrate :: recomputed reach', hydrated?.metrics.reach, EXPECTED[1].reach)
    check('hydrate :: warning cleared', hydrated?.warningFlag ?? null, false)
    const reloaded = await prisma.analysisReport.findUnique({ where: { id: hydrateTarget.id } })
    check(
      'hydrate :: persisted alerts',
      (reloaded?.metrics as Record<string, any>)?.alerts,
      EXPECTED[1].alerts,
    )
    check('hydrate :: persisted warningFlag', reloaded?.warningFlag, false)
    if (reloaded) {
      hydrateTarget.metrics = reloaded.metrics
      hydrateTarget.warningFlag = reloaded.warningFlag
    }
  }

  const rows: string[] = []

  for (const report of reports) {
    const filters = report.filters as Record<string, unknown>
    const key = signatureOf(filters)
    const expected = expectedByKey.get(key)
    if (expected === undefined) {
      failures.push(`unexpected sample report signature ${key} (${report.id})`)
      continue
    }
    if (seenKeys.has(key)) {
      failures.push(`duplicate sample report for ${key} (${report.id})`)
      continue
    }
    seenKeys.add(key)

    // Identity / immutability
    check(`${expected.label} :: filters.from`, new Date(String(filters.from)).toISOString(), expected.filters.from)
    check(`${expected.label} :: filters.to`, new Date(String(filters.to)).toISOString(), expected.filters.to)
    check(`${expected.label} :: filters.districtId`, filters.districtId, expected.filters.districtId)
    check(`${expected.label} :: filters.hazardType`, filters.hazardType, expected.filters.hazardType)
    check(`${expected.label} :: filters.includedSections`, filters.includedSections, expected.filters.includedSections)
    check(`${expected.label} :: filters.language`, filters.language, expected.filters.language)
    check(`${expected.label} :: warningFlag`, report.warningFlag, expected.warningFlag)

    const domain = await container.uc4.snapshotRepository.getById(report.id)
    check(`${expected.label} :: Object.isFrozen (BR2 write-once)`, domain !== null && Object.isFrozen(domain), true)

    // KPIs
    const metrics = report.metrics as Record<string, any>
    check(`${expected.label} :: alerts`, metrics.alerts, expected.alerts)
    check(`${expected.label} :: reach`, metrics.reach, expected.reach)
    check(`${expected.label} :: reports tallies`, metrics.reports, expected.reports)
    const eventTimes = (metrics.shelters.events as Array<{ occurredAt: string }>).map((e) => e.occurredAt)
    if (expected.sheltersMin) {
      const activated = metrics.shelters.activated as number
      const peak = metrics.shelters.peakOccupancy as number
      const ok =
        activated >= expected.sheltersMin.activated &&
        peak >= expected.sheltersMin.peakOccupancy &&
        eventTimes.length === activated * 2
      if (!ok) {
        failures.push(
          `${expected.label} :: shelters (bridge floors): expected activated>=${expected.sheltersMin.activated}, ` +
            `peak>=${expected.sheltersMin.peakOccupancy}, events=2/activated shelter; ` +
            `got activated=${activated}, peak=${peak}, events=${eventTimes.length}`,
        )
      }
    } else if (expected.shelters) {
      check(
        `${expected.label} :: shelters`,
        {
          activated: metrics.shelters.activated,
          peakOccupancy: metrics.shelters.peakOccupancy,
          eventTimes,
        },
        expected.shelters,
      )
    }
    check(`${expected.label} :: supplies.byType`, metrics.supplies.byType, expected.supplies)

    // Shares (order-insensitive multiset)
    const actualShares = [...(sharesByReport.get(report.id) ?? [])].sort((a, b) =>
      `${a.organizationName}|${a.status}|${a.failureReason ?? ''}`.localeCompare(
        `${b.organizationName}|${b.status}|${b.failureReason ?? ''}`,
      ),
    )
    const expectedShares = [...expected.shares].sort((a, b) =>
      `${a.organizationName}|${a.status}|${a.failureReason ?? ''}`.localeCompare(
        `${b.organizationName}|${b.status}|${b.failureReason ?? ''}`,
      ),
    )
    check(`${expected.label} :: shares`, actualShares, expectedShares)

    const supplySummary =
      Object.keys(expected.supplies).length === 0
        ? 'none'
        : Object.entries(expected.supplies)
            .map(([type, s]) => `${type} ${s.percent}%`)
            .join(', ')
    const shareSummary =
      expected.shares.length === 0
        ? 'none'
        : `${expected.shares.filter((s) => s.status === 'SENT').length} SENT / ${expected.shares.filter((s) => s.status === 'FAILED').length} FAILED`

    rows.push(
      `  ${pad(expected.label.slice(0, 2), 3)} ${pad(report.id.slice(0, 8), 9)} ` +
        `alerts=${metrics.alerts.total} reach=${metrics.reach.distinctCitizens} ` +
        `reports=${metrics.reports.verified}/${metrics.reports.pending}/${metrics.reports.rejected} ` +
        `shelters=${metrics.shelters.activated}/${metrics.shelters.peakOccupancy} ` +
        `supplies=[${supplySummary}] warning=${report.warningFlag ? 'YES' : 'no'} shares=${shareSummary}`,
    )
  }

  for (const expected of EXPECTED) {
    if (!seenKeys.has(signatureOf(expected.filters))) {
      failures.push(`missing sample report: ${expected.label}`)
    }
  }

  // ── Report ──
  console.log(' Sample reports (5 expected):')
  for (const row of rows) console.log(row)
  console.log('')

  if (failures.length > 0) {
    console.error(` FAIL: ${failures.length} assertion(s) failed:`)
    for (const failure of failures) console.error(`   - ${failure}`)
    process.exit(1)
  }

  console.log(' PASS: all 5 sample reports match the expected KPIs, filters,')
  console.log('       warning flags, freeze state (Object.isFrozen), share outcomes')
  console.log('       and the zero-KPI hydration gate (recompute + persist).')
  console.log('')
  console.log(' Demo URLs (start the app with `npm run dev`):')
  console.log('   http://localhost:3000/resources/analysis?districtId=00000000-0000-4000-8000-000000000001&from=2026-08-01&to=2026-08-31&hazardType=FLOOD')
  console.log('   http://localhost:3000/resources/analysis/history')
  const r1 = reports.find((r) => signatureOf(r.filters as Record<string, unknown>) === signatureOf(EXPECTED[0].filters))
  if (r1) {
    console.log(`   http://localhost:3000/resources/analysis/${r1.id}`)
    console.log(`   http://localhost:3000/resources/analysis/${r1.id}/charts`)
    console.log(`   http://localhost:3000/resources/analysis/${r1.id}/share`)
    console.log(`   http://localhost:3000/api/analysis/${r1.id}/pdf?lang=EN`)
  }
  console.log('')

  // Unit-suite gate (same command the plan used for UC4).
  const unit = spawnSync('npx', ['vitest', 'run', 'src/modules/uc4-analysis'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, DATA_STORE: 'prisma' },
  })
  if (unit.status !== 0) {
    console.error(' FAIL: uc4 unit suite failed.')
    process.exit(unit.status ?? 1)
  }
  console.log('')
  console.log(` Verified at ${prodClock.now().toISOString()} (clock injected)`)
  console.log('')
}

main().catch((error) => {
  console.error(' VERIFY crashed:', error)
  process.exit(1)
})
