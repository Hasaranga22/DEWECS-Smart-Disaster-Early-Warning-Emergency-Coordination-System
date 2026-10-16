You are working on Group 20's SE3070 Assignment 02 repository (DEWECS - Smart Disaster Early-Warning and Emergency Coordination System for Sri Lanka).
My assigned module is UC4: Generate Post-Event Analysis Report (NADEESHAN R M K - IT23608740).

Please audit and complete all remaining Frontend, Backend, Integration, Seed, and UML tasks for UC4 without breaking any existing passing tests or violating module boundary rules (no Prisma imports outside `adapters/prisma/`, no direct cross-module class imports outside `src/shared/infra/container.ts`, and `Clock`/`IdGenerator` injected everywhere).

Execute the following 8 tasks step by step:

### Task 1: Frontend — Implement A4 Query-Param Prefill on Setup Page (`NA-1`)
1. In `src/app/analysis/page.tsx`:
   - Accept `searchParams: Promise<Record<string, string | string[] | undefined>>` and forward any query parameters (`from`, `to`, `district`, `districtId`, `hazardType`, `lang`) when redirecting to `/resources/analysis`.
2. In `src/app/resources/analysis/page.tsx`:
   - Read URL query parameters using `useSearchParams()` (wrapped in a `<Suspense>` boundary so Next.js 15 build succeeds).
   - If `from`, `to`, `districtId` (or `district`), `hazardType`, or `language` (or `lang`) are present in the query string, pre-populate the form state (`A4: Partner request prefill`).

### Task 2: Frontend — Enforce `includedSections` Filtering (`A5` / `BR12`) & Inline Filter Re-Run (`A1`) on Summary & Charts (`NA-2` & `NA-3`)
1. In `src/app/resources/analysis/[id]/page.tsx` (`NA-2` Summary View):
   - Check `const included = new Set(filters.includedSections)`.
   - Conditionally render each KPI tile and breakdown section only if its section key (`"ALERTS"`, `"REACH"`, `"REPORTS"`, `"SHELTERS"`, `"SUPPLIES"`) is in `included`.
   - Add an inline "Filter & Regenerate Scope (A1)" bar allowing the DMC Official to adjust `districtId` and/or `hazardType` directly on the summary view (keeping the original `from`, `to`, `includedSections`, and `language`) and click "Apply & Generate Scoped Snapshot", which calls `api.generateReport(...)` and navigates to the newly created snapshot ID while leaving the current snapshot untouched in history.
2. In `src/app/resources/analysis/[id]/charts/page.tsx` (`NA-3` Charts View):
   - Check `const included = new Set(report.filters.includedSections)`.
   - Only render "Alert Severity Distribution" if `included.has("ALERTS")`, "Ground Report Decisions" if `included.has("REPORTS")`, and "Relief Supply Distribution" if `included.has("SUPPLIES")`.
   - Add a Shelter Occupancy Timeline / Peak card when `included.has("SHELTERS")` showing `report.metrics.shelters.events` (or activated/peak summary if events are empty).

### Task 3: Frontend & API — Connect Target Language, Privacy Masking, Share History & Email Fallback on Export & Share (`NA-4`)
1. In `src/app/api/analysis/[id]/pdf/route.ts`:
   - Read optional query parameters `?lang=EN|SI|TA` and `?mask=true|false` from `new URL(request.url).searchParams`.
   - Pass the validated `lang` (falling back to `report.filters.language`) to `uc4.pdfExporter.export(report, lang)`.
   - Catch `PdfExportError` explicitly and return `Response.json({ error: 'PdfExportError', message: error.message }, { status: 503 })` (Exception Flow `E3`).
2. In `src/app/api/analysis/[id]/share/route.ts`:
   - Add a `GET` handler (protected by `requireRole(actor, ['DMC_OFFICIAL'])`) that calls `uc4.shareLogRepository.listByReport(id)`, enriches each row with `organizationName` via `uc4.organizationReader`, and returns `{ outcomes }` with status `200`.
3. In `src/app/resources/analysis/_types.ts` and `src/app/resources/analysis/[id]/share/page.tsx` (`NA-4`):
   - Add `getShareHistory(id: string)` to `api` in `_types.ts` and call it on mount in `share/page.tsx` so reopening a previously shared report from History (`A2`) displays its prior `SENT`/`FAILED` audit rows.
   - Update `handleDownloadPdf()` in `share/page.tsx` to open `/api/analysis/${reportId}/pdf?lang=${exportLang}&mask=${privacyMasking}`.
   - In the Share Results table on `share/page.tsx`, when a partner row has `status === "FAILED"`, render both the `Retry` button AND an `Email Fallback` (`mailto:coordinator@partner.org?subject=DEWECS%20Analysis%20Report%20${reportId}`) link (`E4`).

### Task 4: Backend — Enforce `BR1` Role Guard in Domain Services
1. In `src/modules/uc4-analysis/services/SnapshotService.ts` (`generate`) and `src/modules/uc4-analysis/services/ShareService.ts` (`share`):
   - At the start of each method, verify `if (actor.role !== 'DMC_OFFICIAL') throw new ForbiddenError(actor.role, '...')` so `BR1` is enforced at both the service layer and the API route layer.
   - Add unit tests `A10.a` in `SnapshotService.test.ts` and `A10.b` in `ShareService.test.ts` asserting that non-`DMC_OFFICIAL` actors throw `ForbiddenError`.

### Task 5: In-Memory Container Wiring (`src/shared/infra/container.ts`)
1. In `src/shared/infra/container.ts`:
   - When `isPrisma === false` (`DATA_STORE=memory`), ensure UC4's readers read live data from the shared in-memory repositories (`uc1` alerts/attempts if registered, `uc2` decisions, and `uc3` `occupancyEventRepo`, `distributionRepo`, `stockRepo`) or sync seeded data into `InMemoryAlertReader`, `InMemoryAttemptReader`, `InMemoryOccupancyEventReader`, `InMemoryDistributionReader`, and `InMemorySupplyStockReader` so generating a report in memory mode returns realistic non-zero metrics out of the box.

### Task 6: Create `src/shared/seed/demoScenario.ts`
1. Create `src/shared/seed/demoScenario.ts` (as specified in `README.md` §5 and `docs/uc4-context.md` §13) that exports `runDemoScenario(container)` executing the end-to-end Kelani River Basin flood story across UC2 (submit & verify ground report) -> UC1 (issue flood warning) -> UC3 (register shelter, dispatch team, log supply distributions) -> UC4 (generate analysis report snapshot, verify KPIs, and share with 3 partner organisations).

### Task 7: Create Missing PlantUML Diagram Sources in `docs/uml/`
1. Create `docs/uml/seq-uc4-analysis.puml` modelling the revised UC4 sequence diagram with exact class/method names (`SnapshotService`, `ReportFilterValidator`, `AggregationService`, `ReachCalculator`, `PdfExporter`, `ShareService`, the 6 Readers, `SnapshotRepository`, `ShareLogRepository`, `PartnerChannel`) and `alt`/`opt`/`loop` fragments for `A1`–`A5` and `E1`–`E4`.
2. Create `docs/uml/class-integrated.puml` modelling the UC4 domain (`AnalysisReport`, `ReportFilters`, `Metrics`, `ReportShare`, `ShareOutcome`), services, repositories/adapters, and the cross-module reader contracts (`AlertReader`, `AttemptReader`, `ReportDecisionReader`, `OccupancyEventReader`, `DistributionReader`, `SupplyStockReader`).

### Task 8: Verification & Test Suite Run
Run the following commands and fix any issues until all pass with 0 errors and >= 80% coverage:
1. `npx tsc --noEmit`
2. `npx vitest run src/modules/uc4-analysis tests/integration/uc134-to-uc4.test.ts tests/integration/roles.test.ts`
3. `npm run test:uc4`
