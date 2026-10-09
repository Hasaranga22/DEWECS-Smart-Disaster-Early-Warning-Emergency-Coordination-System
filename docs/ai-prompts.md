# DEWECS AI Prompts Log

## Member: DISSANAYAKA L I S (IT23565012)
### Use Case: UC1 - Issue Location-Specific Hazard Warning (+ shared geography, role switcher)

---

### Entry 1 - 2026-10-08
**Prompt:**
> You are helping me build UC1 (Issue Location-Specific Hazard Warning) of DEWECS, a Next.js disaster early-warning system for Sri Lanka. I am DISSANAYAKA, owner of UC1 + shared geography + role switcher. Read Case_Study_Readme.md fully before writing code, especially sections 2, 4, 5 (my tasks), 7, 13, 14, 15, 16, 17 and 19. Follow it exactly. Also read DEWECS_Database_Table_Format_README.md for column names.
> [Full instructions and step-by-step requirements for UC1]

**Checked / Actions Planned:**
- Verified `README.md` and `DEWECS_Database_Table_Format_README.md`.
- Verified shared domain (`District`, `RiverBasin`, `Citizen`, `Officer`, `Organization`, `Role`, `HazardType`) and shared seed / access modules.
- Created `docs/ai-prompts.md` for AI prompt traceability.
- Implemented Step 1 (Severity domain and helpers) with tests.

---

### Entry 2 - 2026-10-08
**Prompt:**
> Yes, proceed. Two adjustments:
> 1. Move all UC1 tests to src/modules/uc1-warning/__tests__/ (README section 17), including Severity.test.ts, and use that folder from now on. Fix imports, rerun tsc and vitest.
> 2. Time is tight (code freeze at 12:00 noon). Do NOT stop after each step. Do steps 2 to 8 in one go (HazardAlert, NotificationAttempt, errors, TargetResolver, gateways + FakeClock/SequentialIdGenerator, in-memory repositories, WarningService, AlertQueryService), with tests written alongside each. Run tsc and vitest after each step and fix failures yourself before moving on, and make one commit per step ("uc1: ..."). Only stop and ask me if something in the README is ambiguous or a check keeps failing.

**Checked / Actions Planned:**
- Moved `Severity.test.ts` to `src/modules/uc1-warning/__tests__/Severity.test.ts`.
- Implemented Steps 2 through 8 in `src/modules/uc1-warning/` with 51 unit tests for W01-W06 and all boundary/error cases.
- Achieved 89.9% coverage for `src/modules/uc1-warning/**`.
- Committed milestone commit `uc1: implement core domain, services, adapters and tests for steps 2 to 8`.

---

### Entry 3 - 2026-10-09
**Prompt:**
> Great work. Proceed with API routes (step 11) and UI (step 12...").

**Checked / Actions Planned:**
- Implemented Step 11: Next.js App Router API endpoints in `src/app/api/warnings/**`:
  - `POST /api/warnings/preview`
  - `POST /api/warnings`
  - `GET /api/warnings`
  - `GET /api/warnings/[id]`
  - `POST /api/warnings/[id]/escalate`
  - `POST /api/warnings/[id]/cancel`
  - `POST /api/warnings/[id]/retry`
  - `GET /api/warnings/evidence`
- Enforced role checks with `getActor` and `requireRole`.
- Verified domain error mapping to HTTP 400, 403, 404, 422, 503 via 11 API route tests.
- Implemented Step 12: Next.js App Router UI pages:
  - `/warnings`: Composer (with read-only verified ground evidence panel), Preview (labelled "estimated recipients", distinct citizens, zero-recipient confirmation), Result (confirmed delivered/failed per channel, distinct citizens reached, retry failed attempts), and Active Alerts list (inline escalate/cancel with validation reasons).
  - `/alerts/[id]`: Phone-width citizen alert receipt (`max-w-md`) with simulated Web Audio device alarm, delivery receipt state, action checklist, and escalation history.
- Implemented Step 13: `PrismaAlertRepository` and mappers in `adapters/prisma/`, supporting `DATA_STORE=memory|prisma`.
- Verified `npx tsc --noEmit` (0 errors), `npm run lint` (0 errors), `npx prisma validate` (valid), and `npx vitest run --coverage` (62 tests passing, 89.44% statement coverage).
- Committed with message `uc1: add UI screens, evidence panel, audio alarm simulation and Prisma adapter`.

### Prompt 4 (UI/UX Contrast & Layout Refinements)
- **Prompt:** UI/UX fixes only for UC1. Light theme in `globals.css` (`#f3f4f6` background, `slate-900` text, dark mode overrides removed), exactly one Role Switcher in header on the right, high contrast across all text elements (WCAG AA), replace raw UUIDs with human-readable district names in evidence and alert receipt cards, make Issue Warning clearly primary, and verify typecheck, lint, and tests.
- **Changes Made:**
  - `src/app/globals.css`: Reset body background to neutral `#f3f4f6` and text color to `#0f172a`, removing dark mode inversion.
  - `src/app/layout.tsx`: Kept single `RoleSwitcherLoader` in `<Suspense>` on the right of header; set body to `bg-slate-100 text-slate-900` and nav links to high-contrast slate.
  - `src/components/RoleSwitcher.tsx`: Dark text, white background, visible border and clear focus ring.
  - `src/app/warnings/WarningsClient.tsx`: Converted raw UUIDs to district names (`getDistrictName`) in Verified Evidence and active warnings; fixed contrast across headings, tabs, steps, badges, inputs, and disabled button tooltips.
  - `src/app/warnings/page.tsx`: Improved contrast on access-restricted fallback screen.
  - `src/app/alerts/[id]/AlertDetailClient.tsx`: Resolved target district and basin names via seed lookup, improved contrast on phone receipt cards, checklist, badges, and bezel.
  - `src/app/alerts/[id]/page.tsx`: Fixed contrast on loading skeleton.
- **Verification:** `npx tsc --noEmit` (0 errors), `npm run lint` (0 errors), `npx vitest run` (62/62 tests passing).
- Committed as `uc1: fix ui contrast and layout`.

### Prompt 5 (Full-Width Spread-Out Dashboard Layout)
- **Prompt:** Layout change for UC1: turn `/warnings` into a full-width spread-out dashboard instead of a narrow centered column. No changes to logic, services, API routes, or tests.
  1. Remove centered max-width wrappers from `<main>` in `layout.tsx` and from top level of `WarningsClient.tsx` and `page.tsx` (use `px-6 lg:px-8`, full width header nav).
  2. Structure: Top bar row with tabs, 4-stat KPI strip (Active warnings, Escalated, Cancelled/Expired, Citizens reached in last alert), full-width stepper.
  3. Main area: 12-column grid (`lg:grid-cols-12`) with 8 cols composer and 4 cols sticky verified evidence with scroll.
  4. Spread fields in composer: hazard type & severity side by side in 2 cols, districts in 3-4 col checkbox grid, message and expiry side by side in 3 cols.
  5. Preview step: left 8 cols for recipient estimates and channel breakdown in card grids, right 4 cols sticky summary and issue actions.
  6. Delivery outcome step: stat cards in a row plus attempts table full width with horizontal scroll.
  7. Active warnings tab: responsive 3-column card grid (`grid-cols-1 md:grid-cols-2 xl:grid-cols-3`).
  8. Responsive: stack to single column below `lg`.
  9. `/alerts/[id]` stays phone-width centered receipt (`max-w-md mx-auto`) on light neutral background with subtle phone-like card.
- Committed as `uc1: dashboard layout`.

## Prompt 7: UC1 + Shared Seed Enhancement (Districts, Basins, Search, Custom Title)
- **Prompt:**
  1. Add remaining Sri Lankan districts (25 total) via `seedId(1, 7..25)` without modifying existing 6 records.
  2. Add river basins after Kelani: Kalu Ganga, Gin Ganga, Nilwala, Mahaweli, Walawe, Attanagalu Oya.
  3. Keep first 30 citizens assigned strictly to original 6 districts; append 19 new citizens (49 total).
  4. Update `seed.test.ts` to expect 25 districts and 49 citizens.
  5. Add search box filtering districts by name as typed.
  6. Add River basins multi-select row; selecting a basin checks its districts; unselecting removes only districts not covered by another selected basin; show selected districts as removable chips with "Clear all".
  7. Send `basinId` only when 1 basin selected and districts set matches; otherwise send `districtIds`.
  8. Add optional "Custom title" (max 80 chars) to entity, Prisma schema, mapper, API routes, composer, active list, and detail receipt.
  9. Add tests for title and multi-basin district union with no duplicate citizens.
- **Verification:** `npx tsc --noEmit` (0 errors), `npm run lint` (0 errors), `npx vitest run` (67/67 tests passing), `npx prisma validate` (valid schema).
- Committed as `uc1: more districts, basins, search and custom title`.

## Prompt 8: UC1 WarningsClient Component Splitting & Citizen Names Display
- **Prompt:**
  1. Split `src/app/warnings/WarningsClient.tsx` into small focused client components in `src/app/warnings/components/` and lib modules in `src/app/warnings/lib/` (target under 250 lines per file, typed props, no `any`).
  2. Components created/extracted: `WarningsHeader.tsx`, `KpiStrip.tsx`, `Stepper.tsx`, `ComposerStep.tsx`, `TargetPicker.tsx`, `EvidencePanel.tsx`, `PreviewStep.tsx`, `ResultStep.tsx`, `AttemptsTable.tsx`, `ActiveAlertsGrid.tsx`, `AlertCard.tsx`, `EscalateModal.tsx`, `CancelModal.tsx`, and `components/ui.tsx`.
  3. Shared helpers and types placed in `src/app/warnings/lib/` (`helpers.ts`, `constants.ts`, `types.ts`).
  4. Show citizen's NAME (looked up from seed citizens by ID) as the main text in `AttemptsTable`, with the last 6 characters of ID in smaller grey text underneath (`...[shortId]`), falling back to short ID if not found.
  5. Split `src/app/alerts/[id]/AlertDetailClient.tsx` into small components under `src/app/alerts/[id]/components/` (`EmergencyHeader.tsx`, `ActionChecklist.tsx`, `HotlinesBar.tsx`) keeping each file well under 250 lines.
- **Verification:** `npx tsc --noEmit` (0 errors), `npm run lint` (0 errors), `npx vitest run` (67/67 tests passing).
- Committed as `uc1: split warnings client into components, show citizen names`.

## Prompt 9: UC1 Delivery Results by District & Collapsed Attempts Log (Privacy Enhancements)
- **Prompt:**
  1. Replace per-citizen attempt log as default view in delivery outcome step with a District Summary Table:
     - One row per targeted district using district names: Targeted citizens, Reached (distinct citizens with ≥1 DELIVERED attempt), SMS delivered, SMS failed, Push delivered, Push failed, Not reached, and small progress bar for reached/targeted.
     - Total row at bottom matching the "Distinct citizens reached" stat card exactly.
     - District Officers see only their assigned district's row.
  2. Add "Needs follow-up" panel:
     - Citizens with NO delivered attempt on any channel, grouped by district, showing short ID (`...[shortId]`) and failure reason (no citizen names, phone numbers, or push tokens).
     - Displays "All targeted citizens were reached" if every citizen was reached.
  3. Full notification attempts log collapsed by default behind "View full attempt log (N attempts)" button:
     - Grouped by district in expandable sections, displaying short IDs (`...[shortId]`), channel, kind, status badge, failure note.
     - Only rendered for `DMC_OFFICIAL` and `DUTY_OFFICER`.
     - No 36-character UUIDs displayed anywhere.
  4. Privacy check: `GET /api/warnings/[id]` strips attempts, distinctCitizensReached, totalAttempts, and channelSummary when actor role is `CITIZEN` (public alert fields only). Added test in `ApiRoutes.test.ts`. Citizen receipt page does not count or list other citizens.
- **Files Changed:**
  - `src/app/api/warnings/[id]/route.ts` (privacy strip for CITIZEN role)
  - `src/modules/uc1-warning/__tests__/ApiRoutes.test.ts` (added unit test for citizen privacy)
  - `src/app/warnings/components/DistrictSummaryTable.tsx` (new: district summary table with progress bars & total row)
  - `src/app/warnings/components/NeedsFollowUpPanel.tsx` (new: unreached citizens panel grouped by district)
  - `src/app/warnings/components/AttemptsTable.tsx` (collapsed full log, expandable by district, short IDs, role restricted)
  - `src/app/warnings/components/ResultStep.tsx` (integrated summary table, follow-up panel, and attempts log)
  - `src/app/warnings/WarningsClient.tsx` (passed actorRole and actorDistrictId to ResultStep)
  - `src/app/warnings/lib/types.ts` (added actorDistrictId to WarningsClientProps)
  - `src/app/warnings/page.tsx` (passed actor.districtId to WarningsClient)
- **Verification:** `npx tsc --noEmit` (0 errors), `npm run lint` (0 errors), `npx vitest run` (68/68 tests passing).
- Committed as `uc1: group delivery results by district, collapse attempt log`.

## Prompt 10: Scope District Officer Data Server-Side in GET /api/warnings/[id]
- **Prompt:**
  1. In `GET /api/warnings/[id]`, when actor is `DISTRICT_OFFICER`, filter attempts, counts (`totalAttempts`, `distinctCitizensReached`), and channel summaries (`channelSummary.sms`, `channelSummary.push`) server-side strictly to that officer's own district.
  2. If an alert does not target the officer's district, return HTTP 403 (Access denied).
  3. Added unit tests in `ApiRoutes.test.ts` for district scoping and unauthorized alert rejection.
- **Files Changed:**
  - `src/app/api/warnings/[id]/route.ts`
  - `src/modules/uc1-warning/__tests__/ApiRoutes.test.ts`
  - `docs/ai-prompts.md`
- **Verification:** `npx tsc --noEmit` (0 errors), `npm run lint` (0 errors), `npx vitest run` (70/70 tests passing).
- Committed as `uc1: scope district officer data server-side`.

## Prompt 11: Clarify Preview Reach Wording & Info Note
- **Prompt:**
  1. In `PreviewStep.tsx`, updated the main recipient number label from "Estimated recipients" to "Estimated reachable registered citizens".
  2. Under that number, added an info note box (`text-slate-600`, info icon `ℹ️`, light blue-grey background `bg-slate-100 border border-slate-200`): "Residents without a registered phone number or push token cannot be reached by this system. Consider public broadcast channels (cell broadcast, sirens, radio) for full coverage."
  3. Kept all counts, breakdowns, zero-recipient confirmation, result step, and citizen receipt intact.
- **Files Changed:**
  - `src/app/warnings/components/PreviewStep.tsx`
  - `docs/ai-prompts.md`
- **Verification:** `npx tsc --noEmit` (0 errors), `npm run lint` (0 errors), `npx vitest run` (70/70 tests passing).
- Committed as `uc1: clarify preview reach wording`.

## Prompt 12: Show Invalid-Action Reasons, Full Expiry Dates, and Light Receipt Background
- **Prompt:**
  1. In `AlertCard.tsx`, added visible inline disabled reason text under action buttons with an info icon (for EMERGENCY: "Already at maximum severity (Emergency). It cannot be escalated."; for CANCELLED or EXPIRED: "Alert is closed. Escalate and cancel are unavailable.").
  2. In `AlertCard.tsx`, updated Expires display to show full date and time (`toLocaleString()`) matching Occurred.
  3. Ensured CANCELLED and EXPIRED alerts display status badges, and cancelled alerts display "Cancelled <date time>: <reason>". Added separate Cancelled and Expired counts to the KPI card in `KpiStrip.tsx` and `WarningsClient.tsx`.
  4. On `/alerts/[id]`, replaced dark background with light `bg-slate-100` page background and high-contrast, clearly readable "Back to Warnings Dashboard" button and "Simulate Offline" toggle button.
- **Files Changed:**
  - `src/app/warnings/components/AlertCard.tsx`
  - `src/app/warnings/components/KpiStrip.tsx`
  - `src/app/warnings/WarningsClient.tsx`
  - `src/app/alerts/[id]/AlertDetailClient.tsx`
  - `src/app/alerts/[id]/page.tsx`
  - `docs/ai-prompts.md`
- **Verification:** `npx tsc --noEmit` (0 errors), `npm run lint` (0 errors), `npx vitest run` (70/70 tests passing).
- Committed as `uc1: show invalid-action reasons, full expiry dates, light receipt background`.






