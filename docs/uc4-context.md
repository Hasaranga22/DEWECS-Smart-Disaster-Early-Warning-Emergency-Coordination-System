# UC4 — Generate Post-Event Analysis Report
## Complete Implementation Context

> **Owner:** NADEESHAN R M K (IT23608740)  
> **Module:** `src/modules/uc4-analysis/`  
> **Pages:** `src/app/analysis/`  
> **API:** `src/app/api/analysis/`  
> **Prisma Schema:** `prisma/schema/uc4.prisma`  
> **Tests:** `src/modules/uc4-analysis/__tests__/` + `tests/integration/`  
> **Diagrams:** `docs/uml/seq-uc4-analysis.puml`, `docs/uml/class-integrated.puml`  
> **Screenshots:** `docs/screenshots/NA-1.png` … `NA-4.png`  
> **Related Group 18 section:** pp. 27–33 | **Related Group 20 section:** Section 4

---

## 0. Quick Reference

| Item | Value |
|------|-------|
| **Use case** | UC4 — Generate Post-Event Analysis Report |
| **Primary actor** | DMC Official |
| **Secondary actors** | Partner Organisation Coordinator (receives shares), System Scheduler (future) |
| **Data sources** | UC1 (alerts + attempts), UC2 (decisions), UC3 (occupancy + distributions) |
| **Output** | Immutable `AnalysisReport` snapshot + PDF + per-recipient share log |
| **Non-negotiable rules** | Dated events only · Distinct citizen count · Snapshot immutability · Timeout = no save |
| **Coverage target** | ≥ 80% of `src/modules/uc4-analysis/**` |
| **Test IDs** | A01 – A11 |

---

## 1. Purpose

The DMC Official generates a **point-in-time, immutable statistical snapshot** of a disaster response period:

- How many alerts were issued
- How many **distinct** citizens were reached
- How ground reports were decided (verified / rejected / pending)
- How shelters were occupied **over time**
- How relief supplies were distributed

The snapshot can be:
- **Exported** as a PDF
- **Shared** with partner organisations (each share logged per recipient)
- **Re-opened** later **without recalculation**

> **Critical principle:** This module reads **dated event records** — never cumulative counters.

---

## 2. Scope

### 2.1 Main success flow

1. Official selects `from` / `to`, optional `districtId`, optional `hazardType`, `includedSections`, `language`.
2. `ReportFilterValidator` validates filters (`from ≤ to`, range ≤ 365 days).
3. `AggregationService` queries **dated** events across 5 readers with a shared `sourceCutoff`.
4. `ReachCalculator` computes:
   - `citizensReachedCount = COUNT(DISTINCT citizenId) WHERE deliveryStatus = DELIVERED`
   - Per-channel counts **separately** (non-additive)
5. `SnapshotService` persists an `AnalysisReport` with `filters`, `sourceCutoff`, `generatedAt`, and frozen `metrics`.
6. UI renders KPIs, charts, and drill-down modals.
7. `PdfExporter` renders the PDF from the **saved snapshot** (not from live data).
8. `ShareService` logs one `ReportShare` per recipient with status `SENT` / `FAILED`.

### 2.2 Alternate flows

| ID | Flow | Trigger |
|----|------|---------|
| **A1** | New filters → new snapshot; old snapshot retained | User changes filters |
| **A2** | Reopen old report from history & share with new partner | `/analysis/history` → reopen |
| **A3** | Export PDF without sharing | Export-only action |
| **A4** | Prefill from query params | `/analysis?district=...&from=...&to=...` |
| **A5** | Included sections: unselected sections omitted | Checkbox deselection |

### 2.3 Exception flows

| ID | Exception | Behavior |
|----|-----------|----------|
| **E1** | Empty period | Valid zero-activity report with `warningFlag=true`; **no exception thrown** |
| **E2** | Aggregation timeout | **No snapshot saved**; retry offered with narrower scope |
| **E3** | Export fails | Snapshot retained; retry offered **without re-aggregation** |
| **E4** | Partner share fails for subset | Report remains valid; per-recipient `FAILED` status + retry |

---

## 3. Tech Stack (Fixed by Team)

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router) + TypeScript |
| Database | PostgreSQL via Prisma 7 (`@prisma/adapter-pg`) |
| Validation | `zod` |
| Tests | Vitest + v8 coverage |
| PDF | `pdf-lib` |
| Charts | `recharts` |
| Deploy | Vercel + Neon |

---

## 4. Folder Structure

```
src/
├─ modules/uc4-analysis/
│  ├─ domain/
│  │  ├─ ReportFilters.ts             # filters + includedSections + language
│  │  ├─ AnalysisReport.ts            # frozen snapshot (Object.freeze)
│  │  ├─ ReportShare.ts               # per-recipient share record
│  │  ├─ ShareOutcome.ts              # service return type
│  │  ├─ Metrics.ts                   # typed metric payload
│  │  ├─ i18n.ts                      # EN/SI/TA labels
│  │  └─ errors.ts                    # typed error classes
│  ├─ services/
│  │  ├─ ReportFilterValidator.ts
│  │  ├─ AggregationService.ts        # uses 5 readers
│  │  ├─ ReachCalculator.ts           # distinct citizens
│  │  ├─ SnapshotService.ts           # generate + timeout + zero-activity
│  │  ├─ PdfExporter.ts
│  │  └─ ShareService.ts
│  ├─ adapters/
│  │  ├─ SnapshotRepository.ts        # interface
│  │  ├─ ShareLogRepository.ts        # interface
│  │  ├─ PartnerChannel.ts            # interface
│  │  ├─ MockPartnerChannel.ts        # mock with configurable failure
│  │  └─ prisma/
│  │     ├─ PrismaSnapshotRepository.ts
│  │     ├─ PrismaShareLogRepository.ts
│  │     └─ mappers.ts
│  ├─ __tests__/
│  │  ├─ fixtures/
│  │  │  ├─ fakeAlerts.ts
│  │  │  ├─ fakeAttempts.ts           # one citizen → 2 channels
│  │  │  ├─ fakeDecisions.ts
│  │  │  ├─ fakeOccupancyEvents.ts
│  │  │  ├─ fakeDistributions.ts
│  │  │  └─ fakeFilters.ts
│  │  ├─ ReportFilterValidator.test.ts
│  │  ├─ ReachCalculator.test.ts
│  │  ├─ AggregationService.test.ts
│  │  ├─ SnapshotService.test.ts
│  │  ├─ PdfExporter.test.ts
│  │  └─ ShareService.test.ts
│  └─ index.ts                        # createUc4Module(deps) factory
├─ app/analysis/
│  ├─ page.tsx                        # NA-1 Report setup
│  ├─ [id]/page.tsx                   # NA-2 Summary KPIs
│  ├─ [id]/charts/page.tsx            # NA-3 Charts
│  ├─ [id]/share/page.tsx             # NA-4 Export & Share
│  └─ history/page.tsx                # Report history
├─ app/api/analysis/
│  ├─ route.ts                        # POST generate / GET history
│  ├─ [id]/route.ts                   # GET snapshot
│  ├─ [id]/pdf/route.ts               # GET PDF
│  └─ [id]/share/route.ts             # POST share / retry
├─ shared/seed/demoScenario.ts
└─ prisma/schema/uc4.prisma
```

---

## 5. API Endpoints (Full Specification)

### 5.1 `POST /api/analysis` — Generate Report

**Request Body:**
```typescript
{
  from: string              // ISO date
  to: string                // ISO date
  districtId?: string       // UUID
  hazardType?: 'FLOOD' | 'LANDSLIDE' | 'CYCLONE' | 'DROUGHT' | 'OTHER'
  includedSections: ('ALERTS' | 'REACH' | 'REPORTS' | 'SHELTERS' | 'SUPPLIES')[]
  language: 'EN' | 'SI' | 'TA'
}
```

**Response — 201:**
```typescript
{
  reportId: string
  generatedAt: string
  sourceCutoff: string
  filters: ReportFilters
  metrics: Metrics
}
```

| Status | Condition |
|--------|-----------|
| 400 | Invalid dates / empty sections / range > 365 days |
| 401 | No actor cookie |
| 403 | Role ≠ DMC_OFFICIAL |
| 503 | Aggregation timeout |
| 500 | Unexpected |

**Business logic:**
1. `getActor(request)` → must be DMC Official
2. Parse body with zod schema
3. Call `SnapshotService.generate(filters, actor)`
4. Return 201 with snapshot

---

### 5.2 `GET /api/analysis` — List Report History

**Query params (optional):** `limit` (default 50), `districtId`, `hazardType`

**Response — 200:** `AnalysisReport[]` (newest first)

| Status | Condition |
|--------|-----------|
| 403 | Not DMC Official |

---

### 5.3 `GET /api/analysis/[id]` — Get Snapshot

**Response — 200:** `AnalysisReport`

| Status | Condition |
|--------|-----------|
| 404 | Report not found |
| 403 | Not DMC Official |

---

### 5.4 `GET /api/analysis/[id]/pdf` — Export PDF

**Response — 200:** `application/pdf` (binary)

**Critical:** Renders from **saved snapshot** — never re-aggregates.

| Status | Condition |
|--------|-----------|
| 404 | Report not found |
| 403 | Not DMC Official |
| 503 | PDF render failed |

---

### 5.5 `POST /api/analysis/[id]/share` — Share with Partners

**Request Body:**
```typescript
{ organizationIds: string[] }   // at least 1
```

**Response — 200 (even with partial failures):**
```typescript
{
  outcomes: Array<{
    organizationId: string
    organizationName: string
    status: 'SENT' | 'FAILED'
    attemptedAt: string
    failureReason?: string
  }>
}
```

**Retries append new `ReportShare` rows** — history preserved.

| Status | Condition |
|--------|-----------|
| 400 | Empty array |
| 404 | Report not found |
| 403 | Not DMC Official |

---

### 5.6 Endpoint Summary

| Method | Path | Purpose | Role | Idempotent? |
|--------|------|---------|------|:-----------:|
| POST | `/api/analysis` | Generate snapshot | DMC Official | ❌ |
| GET | `/api/analysis` | List history | DMC Official | ✅ |
| GET | `/api/analysis/[id]` | Get snapshot | DMC Official | ✅ |
| GET | `/api/analysis/[id]/pdf` | Export PDF | DMC Official | ✅ |
| POST | `/api/analysis/[id]/share` | Share with partners | DMC Official | ⚠️ appends |

---

## 6. Business Logic — Service Layer

### 6.1 `ReportFilterValidator.validate(input) → ValidatedFilters`

**Signature:**
```typescript
class ReportFilterValidator {
  validate(input: unknown): ValidatedFilters
}
```

**Logic (ordered):**
```
1. Parse with zod schema
2. IF from === null OR to === null → ValidationError(['from', 'to'])
3. IF from > to → ValidationError(['from'])
4. IF (to - from) > 365 days → ValidationError(['to'])
5. IF includedSections.length === 0 → ValidationError(['includedSections'])
6. RETURN ValidatedFilters
```

**Why 365-day limit?** Performance — multi-year ranges timeout.

---

### 6.2 `ReachCalculator.compute(attempts) → ReachMetrics`

**Signature:**
```typescript
class ReachCalculator {
  compute(attempts: NotificationAttempt[]): ReachMetrics
}

interface ReachMetrics {
  distinctCitizens: number
  perChannel: {
    PUSH: ChannelStats
    SMS: ChannelStats
  }
}

interface ChannelStats {
  attempted: number
  delivered: number
  failed: number
}
```

**Logic:**
```
1. Filter: deliveryStatus === 'DELIVERED'
2. distinctCitizens = new Set(deliveredAttempts.map(a => a.citizenId)).size
3. Group ALL attempts by channel:
   perChannel[ch].attempted = count(all)
   perChannel[ch].delivered = count(DELIVERED)
   perChannel[ch].failed = count(FAILED)
4. Return { distinctCitizens, perChannel }
```

**Example (G04 fix):**

| Citizen | SMS | Push | Audible |
|---------|-----|------|---------|
| C001 | ✅ | ✅ | ❌ |
| C002 | ❌ | ✅ | ✅ |
| C003 | ❌ | ❌ | ❌ |

**Result:**
- `distinctCitizens = 2` (C001, C002)
- `perChannel.PUSH = { attempted: 3, delivered: 2, failed: 1 }`
- `perChannel.SMS = { attempted: 3, delivered: 1, failed: 2 }`

**Critical:** `distinctCitizens ≠ perChannel.PUSH.delivered + perChannel.SMS.delivered`. Per-channel counts are **non-additive**.

---

### 6.3 `AggregationService.aggregate(filters, cutoff, deadline) → Metrics`

**Signature:**
```typescript
class AggregationService {
  constructor(
    private alertReader: AlertReader,
    private attemptReader: AttemptReader,
    private decisionReader: ReportDecisionReader,
    private occupancyReader: OccupancyEventReader,
    private distributionReader: DistributionReader,
    private reachCalculator: ReachCalculator,
  ) {}

  async aggregate(
    filters: ValidatedFilters,
    sourceCutoff: Date,
    deadline: Date,
  ): Promise<Metrics>
}
```

**Shared filter:**
```typescript
const sharedFilter: Filter = {
  from: filters.from,
  to: filters.to,
  districtId: filters.districtId,
  hazardType: filters.hazardType,
  cutoff: sourceCutoff,
}
```

**Logic — 5 parallel queries:**
```
Promise.all with timeout:
  1. alerts          = alertReader.listAlerts(sharedFilter)
  2. attempts        = attemptReader.listAttempts(sharedFilter)
  3. decisions       = decisionReader.listDecisions(sharedFilter)
  4. occupancyEvents = occupancyReader.listEvents(sharedFilter)
  5. distributions   = distributionReader.listDistributions(sharedFilter)

IF any query exceeds deadline → throw AggregationTimeoutError

metrics.alerts = {
  total, bySeverity, byHazardType
}

metrics.reach = reachCalculator.compute(attempts)

metrics.reports = {
  verified: count(decisions WHERE reviewStatus === 'VERIFIED'),
  rejected: count(decisions WHERE reviewStatus === 'REJECTED'),
  pending:  count(decisions WHERE reviewStatus IN ['PENDING_REVIEW','NEEDS_INFO']),
}

metrics.shelters = {
  activated: unique(shelterId).length,
  peakOccupancy: max cumulative(newCount),
  events: occupancyEvents.map(e => ({ occurredAt, shelterId, previousCount, newCount })),
}

metrics.supplies = {
  byType: groupBy(supplyType) → { distributed, total, percent }
  // percent = total > 0 ? (distributed / total) * 100 : null
}

RETURN metrics
```

**Key:** All 5 readers receive the **same** `filter.cutoff` → coherent point-in-time snapshot.

---

### 6.4 `SnapshotService.generate(filters, actor) → AnalysisReport`

**Signature:**
```typescript
class SnapshotService {
  constructor(
    private validator: ReportFilterValidator,
    private aggregation: AggregationService,
    private repository: SnapshotRepository,
    private audit: AuditLogger,
    private clock: Clock,
    private idGenerator: IdGenerator,
  ) {}

  async generate(input: unknown, actor: Actor): Promise<AnalysisReport>
}
```

**Logic:**
```
1. filters = validator.validate(input)

2. sourceCutoff = clock.now()

3. TRY:
     metrics = await aggregation.aggregate(
       filters,
       sourceCutoff,
       deadline = sourceCutoff + 60_000
     )
   CATCH AggregationTimeoutError:
     audit.logFailure('TIMEOUT', actor.id)
     THROW AggregationTimeoutError      // nothing saved

4. warningFlag = isAllZero(metrics)

5. report = Object.freeze({
     id: idGenerator.next(),
     filters,
     sourceCutoff,
     generatedAt: clock.now(),
     generatedBy: actor.id,
     metrics,
     warningFlag,
   })

6. await repository.save(report)          // write-once

7. audit.logGeneration(report.id, actor.id)

8. RETURN report
```

**Why `Object.freeze`?** Runtime enforcement of immutability in dev.

---

### 6.5 `PdfExporter.export(snapshot, language) → Uint8Array`

**Signature:**
```typescript
class PdfExporter {
  async export(
    snapshot: AnalysisReport,
    language: Language,
  ): Promise<Uint8Array>
}
```

**Logic:**
```
1. doc = PDFDocument.create()
2. page = doc.addPage()

3. Header: Title, Period, Scope, Generated, Source cutoff

4. Sections (only those in filters.includedSections):
   IF 'ALERTS'   IN sections → renderAlertsSection
   IF 'REACH'    IN sections → renderReachSection (distinct + per-channel table)
   IF 'REPORTS'  IN sections → renderReportsSection
   IF 'SHELTERS' IN sections → renderSheltersSection
   IF 'SUPPLIES' IN sections → renderSuppliesSection

5. Footer: snapshot.id, generatedBy, language

6. RETURN await doc.save()
```

**Critical:** Exporter reads **only** from the snapshot object. Never touches readers.

---

### 6.6 `ShareService.share(reportId, organizationIds, actor) → ShareOutcome[]`

**Signature:**
```typescript
class ShareService {
  constructor(
    private repository: SnapshotRepository,
    private shareLog: ShareLogRepository,
    private channel: PartnerChannel,
    private organizations: OrganizationReader,
    private audit: AuditLogger,
    private clock: Clock,
    private idGenerator: IdGenerator,
  ) {}

  async share(
    reportId: string,
    organizationIds: string[],
    actor: Actor,
  ): Promise<ShareOutcome[]>
}
```

**Logic:**
```
1. report = repository.getById(reportId)
   IF null → NotFoundError

2. IF organizationIds.length === 0 → ValidationError

3. outcomes = []

4. FOR orgId IN organizationIds:
     TRY:
       channel.send(report, org)
       log = { status: 'SENT', ... }
     CATCH err:
       log = { status: 'FAILED', failureReason: err.message, ... }
     
     shareLog.save(log)      // ALWAYS save
     outcomes.push(log)

5. audit.logShare(reportId, outcomes, actor.id)

6. RETURN outcomes

// Key: one failure does NOT stop the loop.
// Retries append new rows.
```

---

## 7. Domain Types (Full TypeScript)

### 7.1 `ReportFilters.ts`

```typescript
export type HazardType = 'FLOOD' | 'LANDSLIDE' | 'CYCLONE' | 'DROUGHT' | 'OTHER'
export type IncludedSection = 'ALERTS' | 'REACH' | 'REPORTS' | 'SHELTERS' | 'SUPPLIES'
export type Language = 'EN' | 'SI' | 'TA'

export interface ReportFilters {
  from: Date
  to: Date
  districtId?: string
  hazardType?: HazardType
  includedSections: IncludedSection[]
  language: Language
}
```

### 7.2 `AnalysisReport.ts`

```typescript
import type { ReportFilters } from './ReportFilters'
import type { Metrics } from './Metrics'

export interface AnalysisReport {
  readonly id: string
  readonly filters: ReportFilters
  readonly sourceCutoff: Date
  readonly generatedAt: Date
  readonly generatedBy: string
  readonly metrics: Metrics
  readonly warningFlag: boolean
}
```

### 7.3 `Metrics.ts`

```typescript
export interface Metrics {
  alerts: {
    total: number
    bySeverity: Record<string, number>
    byHazardType: Record<string, number>
  }
  reach: {
    distinctCitizens: number
    perChannel: {
      PUSH: ChannelStats
      SMS: ChannelStats
    }
  }
  reports: {
    verified: number
    rejected: number
    pending: number
  }
  shelters: {
    activated: number
    peakOccupancy: number
    events: Array<{
      occurredAt: Date
      shelterId: string
      previousCount: number
      newCount: number
    }>
  }
  supplies: {
    byType: Record<string, {
      distributed: number
      total: number
      percent: number | null
    }>
  }
}

export interface ChannelStats {
  attempted: number
  delivered: number
  failed: number
}
```

### 7.4 `ReportShare.ts` / `ShareOutcome.ts`

```typescript
export interface ReportShare {
  id: string
  reportId: string
  organizationId: string
  status: 'SENT' | 'FAILED'
  attemptedAt: Date
  actorId: string
  failureReason?: string
}

export interface ShareOutcome extends ReportShare {
  organizationName: string
}
```

### 7.5 `errors.ts`

```typescript
export class ValidationError extends Error {
  constructor(public fields: string[]) {
    super(`Validation failed: ${fields.join(', ')}`)
    this.name = 'ValidationError'
  }
}

export class AggregationTimeoutError extends Error {
  constructor(public elapsedMs: number) {
    super(`Aggregation timeout after ${elapsedMs}ms`)
    this.name = 'AggregationTimeoutError'
  }
}

export class NotFoundError extends Error {
  constructor(public resource: string, public id: string) {
    super(`${resource} ${id} not found`)
    this.name = 'NotFoundError'
  }
}

export class PdfExportError extends Error {
  constructor(public reportId: string, public cause?: string) {
    super(`PDF export failed for report ${reportId}`)
    this.name = 'PdfExportError'
  }
}

export class ForbiddenError extends Error {
  constructor(public role: string, public action: string) {
    super(`Role ${role} cannot perform ${action}`)
    this.name = 'ForbiddenError'
  }
}
```

---

## 8. Repositories & Prisma

### 8.1 `SnapshotRepository` (interface)

```typescript
export interface SnapshotRepository {
  save(report: AnalysisReport): Promise<void>
  getById(id: string): Promise<AnalysisReport | null>
  list(query?: {
    limit?: number
    districtId?: string
    hazardType?: HazardType
  }): Promise<AnalysisReport[]>
  // NO update, NO delete — enforced by design
}
```

### 8.2 `ShareLogRepository` (interface)

```typescript
export interface ShareLogRepository {
  save(share: ReportShare): Promise<void>
  listByReport(reportId: string): Promise<ReportShare[]>
}
```

### 8.3 `PartnerChannel` (interface)

```typescript
export interface PartnerChannel {
  send(report: AnalysisReport, organization: Organization): Promise<void>
  // Throws on failure
}
```

### 8.4 Prisma schema — `prisma/schema/uc4.prisma`

```prisma
model AnalysisReport {
  id            String        @id @default(uuid())
  filters       Json
  sourceCutoff  DateTime      @map("source_cutoff")
  generatedAt   DateTime      @map("generated_at")
  metrics       Json
  warningFlag   Boolean       @default(false) @map("warning_flag")
  generatedBy   String        @map("generated_by")
  shares        ReportShare[]

  @@index([generatedAt])
  @@map("analysis_report")
}

model ReportShare {
  id              String         @id @default(uuid())
  reportId        String         @map("report_id")
  organizationId  String         @map("organization_id")
  status          ShareStatus
  attemptedAt     DateTime       @map("attempted_at")
  actorId         String         @map("actor_id")
  failureReason   String?        @map("failure_reason")
  report          AnalysisReport @relation(fields: [reportId], references: [id])

  @@index([reportId])
  @@map("report_share")
}

enum ShareStatus {
  SENT
  FAILED
}
```

**Rules:**
- No `updatedAt` on `AnalysisReport` — write-once
- No `delete` on `AnalysisReport`
- `ReportShare` allows multiple rows per `reportId` (retries append)

---

## 9. Business Rules (Enforcement Table)

| ID | Rule | Where Enforced | Test |
|----|------|----------------|:----:|
| **BR1** | Only DMC Official generates | API `requireRole` | A10 |
| **BR2** | Snapshot never recalculated | No update/delete; `Object.freeze` | A04 |
| **BR3** | `citizensReachedCount = COUNT(DISTINCT citizenId) WHERE DELIVERED` | `ReachCalculator` | A02 |
| **BR4** | Per-channel attempts shown separately (non-additive) | `Metrics.reach.perChannel` | A02 |
| **BR5** | Aggregation uses dated events only | `AggregationService` reads via readers | A03 |
| **BR6** | Timeout → no snapshot saved | `SnapshotService` throws before save | A06 |
| **BR7** | Empty period → valid zero-activity report | `warningFlag = true` | A05 |
| **BR8** | Per-recipient share outcome | `ShareService` loop | A07 |
| **BR9** | Share failure does not invalidate report | Loop continues | A07 |
| **BR10** | Percentages include denominators; zero → `null` | `Metrics.supplies` | A08 |
| **BR11** | Range ≤ 365 days | `ReportFilterValidator` | A01 |
| **BR12** | `includedSections` filters output | `PdfExporter` skips unselected | A11 |

---

## 10. Test Plan (A01–A11)

| ID | Test Name | Key Assertion |
|----|-----------|---------------|
| **A01** | Invalid date range rejected | Throws `ValidationError(['from'])`; repo count unchanged |
| **A02** | Two channels for one citizen = one reached | `distinctCitizens === 1`; perChannel separate |
| **A03** | New filter → new snapshot | Old report unchanged |
| **A04** | Snapshot immutable after source change | Old report metrics unchanged |
| **A05** | Empty period → zero-activity report | `warningFlag === true` |
| **A06** | Timeout → nothing saved | Throws `AggregationTimeoutError`; repo count unchanged |
| **A07** | Share retry | First FAILED; second SENT; 2 rows logged |
| **A08** | Percentage denominator | Zero denominator → `null` |
| **A09** | Filter scoping | Changing district changes every metric consistently |
| **A10** | Role guard | Non-DMC role → 403 |
| **A11** | Included sections | Unselected sections absent from metrics + PDF |

**Coverage target:** ≥ 80% of `src/modules/uc4-analysis/**` (excluding `adapters/prisma/**`).

**Conventions:**
- `FakeClock` + `SequentialIdGenerator` injected in every test
- `InMemorySnapshotRepository` + `InMemoryShareLogRepository`
- Fakes for all 5 readers
- No real DB, no network
- Test names include the ID: `it("A02: ...")`

---

## 11. UI Screens

### NA-1 — Report Setup (`/analysis`)

```
[Reporting Period: from – to]     ← date pickers with inline validation
[District (optional) ▼]
[Hazard Type (optional) ▼]
Language: ( ) EN  ( ) SI  ( ) TA

INCLUDED SECTIONS:
  ☑ Alerts        ☑ Reach
  ☑ Reports       ☑ Shelters
  ☑ Supplies

ACTIVE FILTER CHIPS: [Kegalle ×] [Flood ×] [EN]

[Cancel]  [Generate Report]
```

**Validation states:**
- `from > to` → red border + "Start must be before end"
- Range > 365 → red border + "Maximum 365 days"
- No sections → disabled button

---

### NA-2 — Summary KPIs (`/analysis/[id]`)

```
Period: 01 Aug – 31 Aug 2026   |   Generated: 02 Sep 2026 10:23
Source cutoff: 31 Aug 2026 23:59   |   Version: v1.0 FINAL

┌──────────┬──────────┬──────────┬──────────┐
│    6     │  18,214  │  42/51   │    5     │
│ Alerts   │ Distinct │ Reports  │ Shelters │
│ Issued   │ Citizens │ Verified │ Activated│
│          │ Reached  │          │          │
└──────────┴──────────┴──────────┴──────────┘

REACH BREAKDOWN (per channel, non-additive):
  Push:  18,000 attempted  →  17,500 delivered  →  500 failed
  SMS:   18,000 attempted  →  15,200 delivered  →  2,800 failed

[Compare With…] [Amend Report] [Export & Share]
```

---

### NA-3 — Charts (`/analysis/[id]/charts`)

```
Hazard Alert Timeline (by week)
[recharts bar chart]

Ground Report Decisions
Verified: ████████████████████ 42  (82%)
Pending:  ██████                6  (12%)
Rejected: ███                   3  (6%)

Supply Distribution
Food:     8,200 of 10,000 = 82%
Water:    5,500 of  5,500 = 100%
Medicine:   640 of    800 = 80%
Shelter:    210 of    300 = 70%

[← Back to Summary]  [Export & Share]
```

**Empty state:**
```
⚠ No activity recorded for this period/filter.
   Figures shown are zero.

[Widen Period]  [Clear Filters]  [Export Empty Report]
```

---

### NA-4 — Export & Share (`/analysis/[id]/share`)

```
Export Format: (•) PDF  ( ) CSV
Language: [English ▼]

🔒 Privacy Masking
  ☑ Apply masking for external recipients
     Masks: NIC, phone, exact GPS, citizen names

PARTNER ORGANISATIONS:
  ☐ Sri Lanka Army – 2nd Battalion    [Internal]
  ☑ World Vision Lanka (NGO)          [External → Mask]
  ☑ Private Donor Consortium          [External → Mask]

SHARE RESULTS (per recipient):
  ✅ World Vision Lanka     SENT     [View]
  ❌ Private Donor Cons.    FAILED   [Retry] [Email]
  ✅ Sri Lanka Army         SENT     [View]

⚠ 1 recipient unreachable. Retry or email fallback.

[Download PDF]  [Retry Failed]  [Close]
```

---

## 12. Integration Contracts Consumed

From `src/shared/contracts/`:

```typescript
interface Filter {
  from?: Date
  to?: Date
  districtId?: string
  hazardType?: HazardType
  cutoff?: Date
}

interface AlertReader {
  listAlerts(f: Filter): Promise<HazardAlert[]>
}
interface AttemptReader {
  listAttempts(f: Filter): Promise<NotificationAttempt[]>
}
interface ReportDecisionReader {
  listDecisions(f: Filter): Promise<ReportDecision[]>
}
interface OccupancyEventReader {
  listEvents(f: Filter): Promise<OccupancyEvent[]>
}
interface DistributionReader {
  listDistributions(f: Filter): Promise<Distribution[]>
}

interface Clock { now(): Date }
interface IdGenerator { next(): string }
```

**Rule:** UC4 imports **only** these interfaces + `types.ts`. Never imports UC1/UC2/UC3 modules directly.

---

## 13. Demo Scenario — `src/shared/seed/demoScenario.ts`

Kelani flood story, invoked by calling **real services**, never by writing rows:

```typescript
async function runDemoScenario(container) {
  // 1. UC2: Citizen C001 submits → Duty Officer verifies
  const report = await container.uc2.submission.submit({ ... })
  await container.uc2.review.verify(report.id, officerId)

  // 2. UC1: DMC Official issues flood warning for Kelani basin
  const alert = await container.uc1.warning.issue({
    hazardType: 'FLOOD',
    targetBasinId: 'kelani',
    severity: 'WARNING',
    message: 'Flood warning for Kelani basin',
    actor: dmcOfficial,
  })

  // 3. UC3: District Officer activates shelter + dispatches team + logs distributions
  await container.uc3.shelter.register({ ... })
  await container.uc3.dispatch.send(teamId, location)
  await container.uc3.distribution.log(stockId, shelterId, 200)
  await container.uc3.distribution.log(stockId, shelterId, 100)

  // 4. UC4: DMC Official generates report
  const analysis = await container.uc4.snapshot.generate({
    from: '2026-08-01', to: '2026-08-31',
    includedSections: ['ALERTS','REACH','REPORTS','SHELTERS','SUPPLIES'],
    language: 'EN',
  }, dmcOfficial)

  // 5. Verify KPIs
  console.assert(analysis.metrics.alerts.total === 1)
  console.assert(analysis.metrics.reach.distinctCitizens > 0)

  // 6. Share with 3 partners → 1 fails → retry
  const outcomes = await container.uc4.share.share(
    analysis.id, [org1, org2, org3], dmcOfficial
  )
  console.assert(outcomes.some(o => o.status === 'FAILED'))
}
```

---

## 14. Coding Standards (Rubric 20 Marks)

- TypeScript `strict` — **no `any`**
- Domain classes plain TS (no Next.js, no Prisma, no browser APIs)
- Constructor injection; **interfaces for every external dependency**
- Typed error classes — never `throw new Error('...')`
- `Clock` and `IdGenerator` injected — never call `new Date()` or `crypto.randomUUID()`
- Small functions, meaningful names, one responsibility per class
- Doc comment on every public service method
- Patterns: Repository, Strategy (channel), Factory (`createUc4Module`)
- Prisma **only** inside `adapters/prisma/`
- No cross-module imports — only `shared/contracts`

---

## 15. Definition of Done

- [ ] Main + A1–A5 alternates + E1–E4 exceptions working
- [ ] 4 UI screens (NA-1..NA-4) match Group 18 wireframes + Group 20 changes
- [ ] History page + query-param prefill
- [ ] 80%+ coverage on `src/modules/uc4-analysis/**`
- [ ] Tests A01–A11 pass with IDs in names
- [ ] Sequence diagram shows alt/opt/loop for all paths
- [ ] Screenshots NA-1..NA-4 captured at final commit
- [ ] `tsc --noEmit`, `lint`, `prisma validate` pass
- [ ] Works with `DATA_STORE=memory` **and** `DATA_STORE=prisma`
- [ ] AI prompts in `docs/ai-prompts.md`
- [ ] Report Section 4 filled with real paths + coverage + commit SHA

---

## 16. Evidence Paths (For the Report)

| What | Path |
|------|------|
| Source | `src/modules/uc4-analysis/` |
| Tests | `src/modules/uc4-analysis/__tests__/`, `tests/integration/` |
| Coverage output | `docs/test-results/uc4-coverage.txt` |
| Diagram source | `docs/uml/seq-uc4-analysis.puml`, `docs/uml/class-integrated.puml` |
| UI routes | `/analysis`, `/analysis/[id]`, `/analysis/[id]/charts`, `/analysis/[id]/share`, `/analysis/history` |
| Screenshots | `docs/screenshots/NA-1.png` … `NA-4.png` |
| Demo data | `src/shared/seed/demoScenario.ts`, `MockPartnerChannel` |
| AI prompts | `docs/ai-prompts.md` |

---

## 17. Critical Reminders (Top 8)

1. **Dated events, not counters.** Every metric uses `occurredAt` + `sourceCutoff`.
2. **Distinct citizen counting.** `COUNT(DISTINCT citizenId)` for delivered only.
3. **Immutability.** No update/delete. New filters → new report.
4. **Timeout = no save.** Throw `AggregationTimeoutError`; repo unchanged.
5. **Empty = valid.** Zero-activity reports persisted with `warningFlag = true`.
6. **Per-recipient share outcomes.** Loop continues on individual failures.
7. **No Prisma outside `adapters/prisma/`.** Services know interfaces only.
8. **Inject `Clock` and `IdGenerator`.** Deterministic tests depend on this.

---

## 18. File → Responsibility Map

| File | Responsibility |
|------|----------------|
| `domain/ReportFilters.ts` | Types for filters |
| `domain/AnalysisReport.ts` | Frozen snapshot interface |
| `domain/Metrics.ts` | Typed metric payload |
| `domain/ReportShare.ts` | Share log entity |
| `domain/ShareOutcome.ts` | Service return type |
| `domain/i18n.ts` | EN/SI/TA labels |
| `domain/errors.ts` | Typed error classes |
| `services/ReportFilterValidator.ts` | Input validation |
| `services/ReachCalculator.ts` | Distinct citizen counting |
| `services/AggregationService.ts` | 5-reader parallel aggregation |
| `services/SnapshotService.ts` | Generate + immutability + timeout |
| `services/PdfExporter.ts` | PDF rendering from snapshot |
| `services/ShareService.ts` | Per-recipient share loop |
| `adapters/SnapshotRepository.ts` | Interface (no update/delete) |
| `adapters/ShareLogRepository.ts` | Interface |
| `adapters/PartnerChannel.ts` | Interface |
| `adapters/MockPartnerChannel.ts` | Mock with failure rate |
| `adapters/prisma/PrismaSnapshotRepository.ts` | Prisma impl |
| `adapters/prisma/PrismaShareLogRepository.ts` | Prisma impl |
| `index.ts` | `createUc4Module(deps)` factory |
| `app/api/analysis/route.ts` | POST generate / GET history |
| `app/api/analysis/[id]/route.ts` | GET snapshot |
| `app/api/analysis/[id]/pdf/route.ts` | GET PDF |
| `app/api/analysis/[id]/share/route.ts` | POST share |
| `app/analysis/page.tsx` | NA-1 Report setup UI |
| `app/analysis/[id]/page.tsx` | NA-2 Summary KPIs UI |
| `app/analysis/[id]/charts/page.tsx` | NA-3 Charts UI |
| `app/analysis/[id]/share/page.tsx` | NA-4 Export & Share UI |
| `app/analysis/history/page.tsx` | History UI |

---

## 19. Related Documents

- Group 20 report Section 4 — critique + scenario + sequence + UI tables
- `docs/uml/seq-uc4-analysis.puml` — sequence diagram (render source)
- `docs/uml/class-integrated.puml` — integrated class diagram
- `Case Study Readme.md` — team plan, contracts, rules
- `DEWECS_Database_Table_Format_README.md` — full DB schema
- `SE3070 - Case Study Assignment 02 Specification.pdf` — rubric

---

**End of Context File — UC4**