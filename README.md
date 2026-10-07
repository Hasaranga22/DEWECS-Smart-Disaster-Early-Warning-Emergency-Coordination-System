# DEWECS – Group 20 (SE3070 Assignment 02)

Smart Disaster Early Warning and Emergency Coordination System for Sri Lanka.
We implement the **Group 18 Assignment 01 design** (with the improvements in our Group 20 report).

- **Deadline:** 9 Oct 2026, 11:59 PM (no commits after this)
- **Code freeze:** 9 Oct 2026, 12:00 noon (after this, bug fixes only)
- **Stack:** Next.js (App Router) + TypeScript, **Prisma 7 + PostgreSQL (Neon / local Docker)**, Vitest (tests + coverage), PWA (offline), Vercel (deploy)

> **How to read this file**
> Sections **1–12** are the original team plan (tasks, rules, contracts). They are unchanged except where marked **➕ ADDED**.
> Sections **13–21** are new: data layer (Prisma), domain model, roles, routes/API, test map, report evidence paths, git workflow, and open decisions.
> Anything marked **➕ ADDED** was missing from the first version – please confirm it in the Day-1 meeting.

---

## 0. Quick start (new – read this first)

```bash
git clone <repo-url> && cd dewecs
cp .env.example .env            # then set DATABASE_URL (see section 13.5)
npm install                     # postinstall runs `prisma generate`
docker compose up -d db         # local PostgreSQL (or use your own Neon branch URL)
npx prisma db push              # create tables (dev only, no migration files)
npx prisma db seed              # load districts, citizens, officers, demo data
npm run dev                     # http://localhost:3000
npx vitest run                  # all unit tests (no database needed)
```

No database yet? Set `DATA_STORE=memory` in `.env` and the app runs fully on in-memory repositories (data resets on restart). **Build and test everything with in-memory first, add Prisma adapters second** (see 13.6).

### Table of contents

| # | Section | # | Section |
|---|---|---|---|
| 0 | Quick start | 11 | Final submission checklist |
| 1 | Team and use cases | 12 | Known limitations |
| 2 | Rules | 13 | **Tech stack & data layer (Prisma)** ➕ |
| 3 | Folder structure | 14 | **Domain model & state machines** ➕ |
| 4 | Contracts | 15 | **Roles & access matrix** ➕ |
| 5 | Tasks per member | 16 | **Pages, API routes, error codes** ➕ |
| 6 | Integration checks | 17 | **Test plan map (IDs → files)** ➕ |
| 7 | Business rules | 18 | **Report evidence paths** ➕ |
| 8 | Commands | 19 | **Git workflow & PR checklist** ➕ |
| 9 | Timeline | 20 | **Open decisions / gaps to confirm** ➕ |
| 10 | Definition of Done | 21 | **Troubleshooting** ➕ |

---

## 1. Team and use cases

| Member | Reg No | Use case | Folder (work ONLY here) | Peer reviewer |
|---|---|---|---|---|
| **DISSANAYAKA L I S** | IT23565012 | **UC1** Hazard Warning (+ shared geography, role switcher) | `src/modules/uc1-warning`, `src/app/warnings` | Nadeeshan |
| **HASARANGA M N** | IT23845978 | **UC2** Ground Report (+ repo setup, PWA, offline) | `src/modules/uc2-report`, `src/app/report`, `src/app/officer` | Dissanayaka |
| **SANDARUWAN H M K** | IT23633322 | **UC3** Emergency Resources (+ shared contracts) | `src/modules/uc3-resources`, `src/app/resources` | Hasaranga |
| **NADEESHAN R M K** | IT23608740 | **UC4** Post Event Analysis (+ integration, final PDF) | `src/modules/uc4-analysis`, `src/app/analysis` | Sandaruwan |

**➕ ADDED – extra folders each member also owns** (these were used by the plan but not listed above):

| Member | Also owns |
|---|---|
| DISSANAYAKA | `src/app/alerts` (route `/alerts/[id]`), `src/app/api/warnings`, `src/shared/domain`, `src/shared/seed` (except `demoScenario.ts`), `src/shared/access`, `src/components/RoleSwitcher*`, `src/app/layout.tsx`, `prisma/schema/shared.prisma`, `prisma/schema/uc1.prisma` |
| HASARANGA | `src/app/api/reports`, `src/app/api/officer`, `src/app/manifest.*`, `public/` (icons, sw), `prisma/schema/uc2.prisma`, repo root config (`package.json`, `tsconfig`, `vitest.config.ts`, ESLint/Prettier, `docker-compose.yml`, `.env.example`, `prisma.config.ts`, `prisma/seed.ts`) |
| SANDARUWAN | `src/app/api/resources`, `src/shared/contracts`, `src/shared/infra`, `prisma/schema/uc3.prisma` |
| NADEESHAN | `src/app/api/analysis`, `src/shared/seed/demoScenario.ts`, `tests/integration/`, `docs/` (final PDF, screenshots index, AI prompts appendix), `prisma/schema/uc4.prisma` |

**Peer-review chain:** Nadeeshan reviews Dissanayaka → Dissanayaka reviews Hasaranga → Hasaranga reviews Sandaruwan → Sandaruwan reviews Nadeeshan.

---

## 2. Rules (everyone must follow)

1. Work only inside **your own folders**. Need a change in someone else's folder? Ask them.
2. Modules talk to each other **only through `src/shared/contracts`** interfaces. Never import another module's class directly.
3. **No login/signup** (spec says it is not graded). We use a **Role Switcher** dropdown instead.
4. Business logic = plain TypeScript classes (no Next.js, no browser APIs inside) so unit tests are easy. UI and API routes stay thin.
5. Layers: `UI → API route → Service → Repository / Adapter`. Use interfaces + constructor injection (SOLID).
6. Branches: `feat/uc1-warning`, `feat/uc2-report`, `feat/uc3-resources`, `feat/uc4-analysis`. No direct push to `main`; open a PR and the peer reviewer approves.
7. Commit messages start with the UC: `uc1: add escalation rules`.
8. Tests must cover **positive, negative, edge and error** cases. Target **80%+ coverage** of your own module.

**➕ ADDED rules (data layer and consistency):**

9. **Prisma is allowed ONLY inside `adapters/prisma/`** of a module (and `src/shared/infra/prisma/`). Services, domain classes and tests never import `@prisma/client` or the generated client.
10. Edit only **your own** `prisma/schema/<uc>.prisma` file. Shared tables live in `shared.prisma` (Dissanayaka). Changing another member's model = ask them.
11. **No Prisma relations between modules.** Reference other modules' records by plain string IDs (`alertId`, `reportId`). Relations are allowed inside your module and to shared tables (`District`, `Citizen`, `Officer`, `Organization`).
12. **Time and IDs are injected.** Never call `new Date()`, `Date.now()` or `crypto.randomUUID()` inside a service or domain class – use `Clock` and `IdGenerator`. (Needed for deterministic tests.)
13. **API routes validate input** (use `zod`), call exactly one service method, and map domain errors to HTTP status codes using the table in section 16.3. No business logic in routes or components.
14. Never commit `.env`, `node_modules`, `src/generated`, or force-push shared branches.
15. Domain errors are typed classes (e.g. `AlertNotEscalatableError`), never plain `Error("...")` strings, so UI can show the right message and tests can assert the type.

---

## 3. Folder structure

> File names inside modules are **suggested names** – keep the folder layout (`domain / services / adapters / __tests__`) and the module root `index.ts` factory; the exact class file names can be adjusted by the owner.

```
dewecs/
├─ prisma/
│  ├─ schema/                          # Prisma 7 multi-file schema (one file per owner)
│  │  ├─ base.prisma                   # generator + datasource  (Hasaranga)
│  │  ├─ shared.prisma                 # District, RiverBasin, Citizen, Officer, Organization   (Dissanayaka)
│  │  ├─ uc1.prisma                    # HazardAlert, NotificationAttempt, DistrictNotification (Dissanayaka)
│  │  ├─ uc2.prisma                    # GroundReport, ReportAuditEntry                         (Hasaranga)
│  │  ├─ uc3.prisma                    # Shelter, RescueTeam, SupplyStock, events, ConflictQueue (Sandaruwan)
│  │  └─ uc4.prisma                    # AnalysisReport, ReportShare                            (Nadeeshan)
│  ├─ migrations/                      # created once, at the end (see 13.4)
│  └─ seed.ts                          # calls shared seed + each module's seed
├─ prisma.config.ts                    # Prisma 7 CLI config (schema folder, DATABASE_URL, seed)
├─ public/
│  ├─ manifest.json  icons/            # PWA (Hasaranga)
│  └─ sw.js (generated by serwist)
├─ docs/
│  ├─ uml/                             # EDITABLE diagram sources (see 18)
│  │  ├─ usecase.puml                  # Figure 1
│  │  ├─ class-reports-alerts.puml     # Figure 2
│  │  ├─ class-resources.puml          # Figure 3 (shelter/team/stock)
│  │  ├─ class-integrated.puml         # integrated diagram (Nadeeshan)
│  │  ├─ seq-uc1-warning.puml          # UC1 sequence
│  │  ├─ seq-uc2-report.puml           # Figure 6
│  │  ├─ seq-uc3-resources.puml        # Figure 5
│  │  └─ seq-uc4-analysis.puml         # Figure 4
│  ├─ screenshots/                     # DI-1..4, HA-1..4, SA-1..4, NA-1..4 (png)
│  ├─ test-results/                    # uc1-coverage.txt ... uc4-coverage.txt + all-tests.txt
│  └─ ai-prompts.md                    # every AI prompt used + what was checked/changed (all members append)
├─ tests/
│  └─ integration/                     # Nadeeshan: contract + role + demo-scenario tests
├─ src/
│  ├─ shared/
│  │  ├─ domain/                       # District, RiverBasin, Citizen, Officer, Organization, Role, HazardType
│  │  ├─ contracts/                    # interfaces between modules (frozen Day 1)
│  │  │   ├─ VerifiedEvidenceProvider.ts   DistrictNotificationStore.ts
│  │  │   ├─ AlertReader.ts  AttemptReader.ts  ReportDecisionReader.ts
│  │  │   ├─ OccupancyEventReader.ts  DistributionReader.ts
│  │  │   ├─ Clock.ts  IdGenerator.ts  Filter.ts
│  │  │   └─ types.ts                  # VerifiedEvidence, DistrictNotification, ReportDecision, ... (see section 4)
│  │  ├─ seed/                         # districts, citizens, officers, organizations, demoScenario
│  │  ├─ infra/
│  │  │   ├─ InMemoryRepository.ts     # stored on globalThis
│  │  │   ├─ Repository.ts             # generic Repository<T> interface
│  │  │   ├─ TransactionRunner.ts      # ➕ interface + InMemory impl (atomic rollback)
│  │  │   ├─ Clock.ts (SystemClock)  IdGenerator.ts (UuidGenerator)
│  │  │   ├─ fakes/                    # FakeClock, SequentialIdGenerator (tests)
│  │  │   ├─ prisma/
│  │  │   │   ├─ client.ts             # ➕ singleton PrismaClient (globalThis) + pg adapter
│  │  │   │   └─ PrismaTransactionRunner.ts
│  │  │   └─ container.ts              # ➕ composition root: DATA_STORE=memory|prisma, wires all modules
│  │  └─ access/                       # ➕ getActor(request), requireRole(...), role cookie helpers
│  ├─ modules/
│  │  ├─ uc1-warning/
│  │  │   ├─ domain/       HazardAlert, NotificationAttempt, Severity, AlertStatus, errors
│  │  │   ├─ services/     WarningService, TargetResolver, AlertQueryService (AlertReader + AttemptReader)
│  │  │   ├─ adapters/     ChannelGateway, MockSmsGateway, MockPushGateway,
│  │  │   │                AlertRepository (interface), prisma/PrismaAlertRepository, prisma/mappers
│  │  │   ├─ seed/         (optional) demo alerts
│  │  │   ├─ index.ts      createUc1Module(deps) factory
│  │  │   └─ __tests__/
│  │  ├─ uc2-report/
│  │  │   ├─ domain/       GroundReport, LocalOutboxEntry, ReviewStatus, OutboxStatus, errors
│  │  │   ├─ services/     ReportValidator, SubmissionService, OutboxSyncService,
│  │  │   │                ReviewService, DuplicateDetector, EvidenceProviderImpl, DecisionQueryService
│  │  │   ├─ adapters/     ReportRepository (interface), prisma/PrismaReportRepository
│  │  │   ├─ client/       IdbOutboxRepository (idb-keyval), NetworkStatus, compressImage,
│  │  │   │                geolocation wrapper, SimulateOffline toggle   (browser-only code lives HERE)
│  │  │   ├─ index.ts
│  │  │   └─ __tests__/
│  │  ├─ uc3-resources/
│  │  │   ├─ domain/       Shelter, RescueTeam, SupplyStock, OccupancyEvent, Distribution, errors
│  │  │   ├─ services/     ShelterService, DispatchService, DistributionService,
│  │  │   │                ProcessedActionStore, ConflictQueue, DashboardService, event readers
│  │  │   ├─ adapters/     repositories (interfaces), prisma/*
│  │  │   ├─ seed/         shelters, teams, stock
│  │  │   ├─ index.ts
│  │  │   └─ __tests__/
│  │  └─ uc4-analysis/
│  │      ├─ domain/       ReportFilters, AnalysisReport (frozen), ReportShare, errors
│  │      ├─ services/     ReportFilterValidator, AggregationService, ReachCalculator,
│  │      │                SnapshotService, PdfExporter, ShareService
│  │      ├─ adapters/     SnapshotRepository, ShareLogRepository, MockPartnerChannel, prisma/*
│  │      ├─ index.ts
│  │      └─ __tests__/    fixtures/ (fake alerts, attempts, decisions, occupancy events, distributions)
│  ├─ app/                             # Next.js pages + API routes (thin)
│  │  ├─ layout.tsx                    # nav shell + RoleSwitcher (Dissanayaka)
│  │  ├─ page.tsx                      # home / links to modules
│  │  ├─ warnings/        (UC1)        # composer, preview, active list, result
│  │  ├─ alerts/[id]/     (UC1)        # alert detail + citizen receipt
│  │  ├─ report/          (UC2)        # new, outbox, mine
│  │  ├─ officer/reports/ (UC2)        # duty-officer queue + detail
│  │  ├─ resources/       (UC3)        # dashboard, dispatch, distribution, shelters
│  │  ├─ analysis/        (UC4)        # setup, summary, charts, export/share, history
│  │  └─ api/
│  │      ├─ warnings/  reports/  officer/  resources/  analysis/    # one folder per owner
│  └─ components/                      # shared UI (Button, StatusBadge, Toast, ErrorBanner, EmptyState)
├─ .env.example   docker-compose.yml   vitest.config.ts   package.json   tsconfig.json
└─ README.md
```

**Dependency direction (must never be reversed):**

```
app/ (pages, api)  →  modules/*/index.ts  →  services  →  domain
                                         ↘  adapters (prisma, mock gateways)
modules/*  →  shared/contracts, shared/domain, shared/infra   (allowed)
modules/ucX  →  modules/ucY                                   (FORBIDDEN – use contracts)
shared/contracts  →  shared/domain only
```

Only `src/shared/infra/container.ts` may import several modules at once (to wire the contracts together).

---

## 4. Contracts (Sandaruwan writes, all approve on Day 1)

```ts
// UC2 -> UC1
interface VerifiedEvidenceProvider { listVerified(districtId?: string): VerifiedEvidence[] }

// UC1 -> UC3
interface DistrictNotificationStore {
  add(n: DistrictNotification): void
  listForDistrict(districtId: string): DistrictNotification[]
}

// Readers used by UC4
interface AlertReader          { listAlerts(f: Filter): HazardAlert[] }            // UC1
interface AttemptReader        { listAttempts(f: Filter): NotificationAttempt[] }  // UC1
interface ReportDecisionReader { listDecisions(f: Filter): ReportDecision[] }      // UC2
interface OccupancyEventReader { listEvents(f: Filter): OccupancyEvent[] }         // UC3
interface DistributionReader   { listDistributions(f: Filter): Distribution[] }    // UC3

interface Clock { now(): Date }
interface IdGenerator { next(): string }
```

Every dated record must have: `id`, `occurredAt`, `districtId`, and `hazardType` (where relevant).

**➕ ADDED – shared types the contracts refer to (write these in `contracts/types.ts`):**

```ts
type HazardType = 'FLOOD' | 'LANDSLIDE' | 'CYCLONE' | 'DROUGHT' | 'OTHER'   // 'OTHER' only for ground reports

interface Filter {                // used by every Reader; all fields optional
  from?: Date; to?: Date          // inclusive range on occurredAt
  districtId?: string
  hazardType?: HazardType
  cutoff?: Date                   // "source cutoff" – ignore records created after this (UC4 snapshots)
}

interface VerifiedEvidence {      // returned by UC2, shown in UC1 composer (read-only)
  reportId: string; hazardType: HazardType; districtId: string
  lat: number; lng: number; severityIndication?: 'LOW'|'MEDIUM'|'HIGH'
  confidence: 'FULL'|'REDUCED'; corroborationCount: number
  decidedAt: Date; occurredAt: Date            // decision time
}

interface DistrictNotification {  // written by UC1, read by UC3
  id: string; alertId: string; districtId: string; hazardType: HazardType
  kind: 'ISSUED' | 'ESCALATED'; severity: string; occurredAt: Date; readAt?: Date
}

interface ReportDecision {        // read by UC4 (see open decision #1 in section 20)
  id: string; reportId: string; districtId: string; hazardType: HazardType
  reviewStatus: 'PENDING_REVIEW'|'NEEDS_INFO'|'VERIFIED'|'REJECTED'
  occurredAt: Date; officerId?: string; reason?: string
}
// HazardAlert, NotificationAttempt, OccupancyEvent, Distribution: defined by their owners but must
// expose at least { id, occurredAt, districtId, hazardType } and be exported from contracts/types.ts.
```

**Contract rules:** contracts are **frozen after Day-1 approval**. Adding an optional field is fine (tell the others in the group chat); renaming or removing a field needs all four approvals.

---

## 5. Tasks per member

### DISSANAYAKA (IT23565012) – UC1 Issue Location-Specific Hazard Warning

**A. Shared work (Day 1, first, everyone waits for this)**
- [ ] `shared/domain`: `District`, `RiverBasin`, `Citizen` (phone, pushToken, districtId), `Officer`, `Role`
- [ ] `shared/seed`: ~6 districts, Kelani river basin (Colombo + Gampaha + Kegalle), ~30 citizens, officers for 4 roles
- [ ] **Role Switcher** (top bar dropdown: Citizen / Duty Officer / DMC Official / District Officer) + route guards ("Access denied")
- [ ] `app/layout.tsx` navigation shell with links to all modules
- [ ] Vercel deployment setup

**B. UC1 code**
- [ ] `HazardAlert`: states ACTIVE / ESCALATED / CANCELLED / EXPIRED; severity order Advisory < Watch < Warning < Emergency; `escalate()` (error if max severity or closed); `cancel()`
- [ ] `NotificationAttempt`: channel (PUSH/SMS), status (QUEUED/SENT/DELIVERED/FAILED), citizenId, alertId, timestamps
- [ ] `TargetResolver`: districts or river basin -> **unique** citizens
- [ ] `WarningService`: `preview()`, `issue()` (**save ACTIVE alert first, then dispatch**), `escalate()`, `cancel()` (cancellation notice to earlier recipients), `retryFailed()`
- [ ] `ChannelGateway` interface + `MockSmsGateway`, `MockPushGateway` (configurable failure rate)
- [ ] Notify District Officer (via `DistrictNotificationStore`) on issue and on every escalation
- [ ] Implement `AlertReader` and `AttemptReader` for UC4
- [ ] Show verified reports (from `VerifiedEvidenceProvider`) as evidence in the composer; **never auto-issue**
- [ ] Exceptions: zero citizens (ask confirm, count zero), partial channel failure (continue others), invalid escalate/cancel (no change)

**C. UI** (`app/warnings`, `/alerts/[id]`)
- [ ] Composer, Preview (label "estimated recipients"), Active list (escalate/cancel + reason when invalid), Result (delivered/failed per channel + distinct citizens), citizen alert receipt (phone width)

**D. Tests:** W01–W06 + cancel notice, retry, max severity, expired alert, zero citizens, role check (Duty Officer cannot issue)

**E. Report:** Section 3, Figure 1 (use case diagram), Figure 3 (UC1 sequence), screenshots DI-1 to DI-4

> **➕ ADDED for Dissanayaka (missing from the original list – from the Group 18 UC1 scenario):**
> - [ ] **Expiry:** add `expiresAt` to `HazardAlert` and `WarningService.expireDueAlerts()` (uses `Clock`) so the **EXPIRED** state is reachable and testable; the active list shows expired alerts as closed
> - [ ] **Escalate with target widening:** `escalate(alertId, newSeverity, expandTo?)` – re-dispatch to previously notified citizens **plus newly resolved citizens** (no duplicates); notify District Officer again
> - [ ] **Audible alert = device behaviour after receipt:** the citizen receipt page (`/alerts/[id]`) plays the alarm sound only when the alert is opened/received – never claimed at dispatch time (critique G03). Also show action + time + QUEUED state for offline devices
> - [ ] **Hazard types in composer:** Flood / Landslide / Cyclone / Drought only (no "Other")
> - [ ] **Evidence panel:** show `severityIndication` and corroboration count from `VerifiedEvidence`; a "high severity" badge may *suggest* escalation but **must not** call `issue()` or `escalate()`
> - [ ] **Role helpers** `src/shared/access`: `getActor()`, `requireRole()` + role cookie, used by every API route (all members use these)
> - [ ] **Prisma:** `shared.prisma`, `uc1.prisma`, `PrismaAlertRepository` (+ mappers), `prisma/seed.ts` hooks for the shared seed (section 13)
> - [ ] **Test the "alert saved before dispatch" rule** with a repository spy (W02) and the distinct-reach rule (W03)

---

### HASARANGA (IT23845978) – UC2 Submit and Verify Ground Hazard Report

**A. Shared work (Day 1, first 2 hours, everyone waits for this)**
- [ ] Create GitHub repo, `create-next-app` (TypeScript), Vitest + coverage, ESLint + Prettier
- [ ] Push the empty folder structure above, protect `main`, README
- [ ] PWA: `manifest.json`, icons, service worker (`@serwist/next`), "Ready for offline ✓" badge

**B. UC2 code**
- [ ] `GroundReport` (reviewStatus PENDING_REVIEW / NEEDS_INFO / VERIFIED / REJECTED, `version`, `confidence`, captureTime, syncTime) and `LocalOutboxEntry` (PENDING_SYNC / SYNCING / FAILED). **Two separate state machines.**
- [ ] `ReportValidator`: missing hazard/description/location -> highlight fields, keep draft
- [ ] `SubmissionService`: online -> upload directly; offline -> save in outbox
- [ ] `OutboxSyncService`: **idempotent by localId** (same localId = exactly one central report)
- [ ] `ReviewService`: verify / reject(reason) / requestInfo, with **optimistic lock** (`expectedVersion` mismatch -> conflict, no overwrite)
- [ ] `DuplicateDetector`: same type + radius + time window -> link as corroboration (keep both reports)
- [ ] Evidence fallbacks: GPS accuracy > 100 m -> manual pin; no photo -> reduced confidence; corrupt photo -> ask replacement, keep other input
- [ ] Implement `VerifiedEvidenceProvider` (VERIFIED only) and `ReportDecisionReader`
- [ ] Client side: `IdbOutboxRepository` (`idb-keyval`), `NetworkStatus`, `compressImage()` (max 1280 px, quality 0.7), geolocation wrapper, **"Simulate Offline" toggle**

**C. UI**
- [ ] `/report/new` (phone-size form, camera, manual pin), `/report/outbox` (local receipt vs central receipt shown separately), `/officer/reports` (queue + detail: photo, accuracy, capture/sync times, duplicates, decision note), `/report/mine` (reporter status: needs info / verified / rejected + reason)

**D. Tests:** G01–G07 + duplicate linking, corrupt photo, clarification flow, concurrent decision

**E. Report:** Section 6, Figure 2 (class diagram, with Dissanayaka), Figure 6 (UC2 sequence), screenshots HA-1 to HA-4

> **➕ ADDED for Hasaranga (missing from the original list – from the Group 18 UC2 scenario and our report):**
> - [ ] **Repo & tooling for Prisma (Day 1, with the repo setup):** `npm i prisma @prisma/client @prisma/adapter-pg pg dotenv tsx zod`, create `prisma.config.ts`, `prisma/schema/base.prisma`, `prisma/seed.ts`, `docker-compose.yml` (PostgreSQL), `.env.example`, `.gitignore` (`.env`, `src/generated`), npm scripts from section 8, `vitest.config.ts` with coverage include/exclude (13.7)
> - [ ] **Reporter clarification:** `ReviewService.requestInfo()` -> NEEDS_INFO; reporter adds photo/comment on `/report/mine` (`addClarification()`), status returns to PENDING_REVIEW **on the same report** (same id, `version` +1) and the officer re-reviews it
> - [ ] **Citizen vs volunteer:** if the reporter is a plain Citizen (`isVolunteer=false`), the form shows the "call the emergency hotline if life is in danger" reminder
> - [ ] **Permanent sync failure exception:** storage full / data cleared -> outbox entry `FAILED` with warning "could not be saved or sent – resubmit or contact the Duty Officer by radio/phone"
> - [ ] **Reject notifies reporter** (reason shown on `/report/mine`); verify notifies reporter; keep full audit trail (who, when, why) in `ReportAuditEntry` – needed by UC4
> - [ ] **High-severity flag:** verified report stores `severityIndication`; exposed through `VerifiedEvidence` only. UC2 **never** calls UC1
> - [ ] **Duplicate rule:** both reports stay; the newer one gets `linkedToReportId`, officer sees `corroborationCount`
> - [ ] **Unsynced report is invisible to the officer queue** (G02 test) – the queue reads only central (Prisma/in-memory) reports; the outbox is IndexedDB only
> - [ ] **Photo storage:** compressed image stored as data URL in the DB for the demo (≈ <200 KB after `compressImage`); reject files > 1 MB server-side
> - [ ] **Prisma:** `uc2.prisma` (`GroundReport` with `@unique localId`, `ReportAuditEntry`), `PrismaReportRepository` with `updateMany({ where:{id, version} })` optimistic lock

---

### SANDARUWAN (IT23633322) – UC3 Coordinate Emergency Resources

**A. Shared work (Day 1, first 2-3 hours, everyone waits for this)**
- [ ] Write `shared/contracts/*` (section 4) and get approval from all members
- [ ] `shared/infra`: `InMemoryRepository<T>` (stored on `globalThis`), `SystemClock`, `UuidGenerator`, plus fake versions for tests

**B. UC3 code**
- [ ] `Shelter` (capacity, occupancy, `version`, FULL status), `RescueTeam` (AVAILABLE -> EN_ROUTE -> ON_SITE -> RETURNING -> AVAILABLE, owner organization), `SupplyStock` (organization, onHand)
- [ ] `OccupancyEvent` and `Distribution` (dated: quantity, destination, owner org, actor)
- [ ] `ShelterService.updateOccupancy(actionId, expectedVersion, newCount)`: reject over capacity; **never touches stock**
- [ ] `DispatchService`: only AVAILABLE team; cross-organization needs confirmation; no team -> suggest next-nearest / backup / unassigned escalation
- [ ] `DistributionService`: **atomic** (insufficient stock -> nothing changes); **never touches occupancy**
- [ ] `ProcessedActionStore` (same actionId twice = no duplicate) and `ConflictQueue` (version conflict kept for review, never silently overwritten)
- [ ] Read `DistrictNotificationStore` so an escalated UC1 alert preselects the district
- [ ] Implement `OccupancyEventReader` and `DistributionReader` for UC4

**C. UI** (`app/resources`)
- [ ] Dashboard (last refresh + district scope), Dispatch (available teams, capability, ownership, confirm destination), Distribution (available stock, source org, quantity validation), Shelter status (full state + alternative shelter + pending/conflict state)

**D. Tests:** R01–R06 + cross-org confirmation, no team available, full shelter alternatives, team state transitions

**E. Report:** Section 5, Figure 3 (shelter/team/stock class diagram), Figure 5 (UC3 sequence), screenshots SA-1 to SA-4

> **➕ ADDED for Sandaruwan (missing from the original list – from the Group 18 UC3 scenario and our report):**
> - [ ] **Activate / register shelter** (Group 18 main flow steps 5–8): `ShelterService.registerShelter(name, location, capacity, organizationId, districtId)` -> occupancy 0, linked to district + owner organization; the "Activate shelter" form on the dashboard. FULL-shelter flow suggests this
> - [ ] **`TransactionRunner` interface** in `shared/infra` (+ InMemory impl with rollback, + `PrismaTransactionRunner` using `prisma.$transaction`). `DistributionService` uses it so R03 "nothing changes" is true in memory **and** in the database
> - [ ] **Dispatch record + team status history:** `TeamStatusEvent` (teamId, from, to, actor, occurredAt, incident/location) so every transition is dated. Owning organization coordinator is "notified" (mock log entry)
> - [ ] **Dashboard district scope:** officer sees only their assigned district (`Officer.districtId`); other districts -> "Access denied" (role test)
> - [ ] **Org-owned stock listing:** distribution screen shows stock grouped by owning Organization (Government / Armed Forces / NGO / Private Donor)
> - [ ] **Offline action (A4):** the UI can queue a shelter/distribution action with `actionId`; shows PENDING until confirmed; conflict -> `ConflictQueue` item shown on Shelter status (SA-4)
> - [ ] **Shared infra extras:** `Repository<T>` interface, `container.ts` composition root skeleton (`DATA_STORE=memory|prisma`) – every other member adds one line for their module; `PrismaClient` singleton in `shared/infra/prisma/client.ts`
> - [ ] **Prisma:** `uc3.prisma` (`Shelter.version`, `ProcessedAction.actionId @id`, `ConflictQueueItem`), Prisma repositories using `updateMany({ where:{id, version} })`; `DistributionReader` returns **dated** rows, never current totals

---

### NADEESHAN (IT23608740) – UC4 Generate Post Event Analysis Report

**A. Shared work**
- [ ] Day 1: fixtures in `uc4-analysis/__tests__/fixtures` (fake alerts, attempts where one citizen got 2 channels, decisions, occupancy events, distributions) so UC4 can be built alone
- [ ] Day 2 evening: integration tests (section 7)
- [ ] `seed/demoScenario.ts`: one Kelani flood story (report -> verify -> alert -> dispatch -> distribution -> analysis)

**B. UC4 code**
- [ ] `ReportFilters` + `ReportFilterValidator` (from > to -> reject, nothing saved)
- [ ] `AggregationService`: uses the 5 readers, every metric scoped by the same filters
- [ ] `ReachCalculator`: **distinct citizens with at least one delivered attempt**, per-channel counts shown separately
- [ ] `AnalysisReport`: frozen snapshot (filters, sourceCutoff, generatedAt, metrics); use `Object.freeze`
- [ ] `SnapshotService`: timeout -> save nothing; empty period -> valid zero-activity report; new filters -> new snapshot, old one kept
- [ ] `PdfExporter` (`pdf-lib`, from the saved snapshot) and `ShareService` + `MockPartnerChannel` (one `ReportShare` log per partner; one failure does not stop others; retry failed one)
- [ ] Reopen an old report and share it with a new partner

**C. UI** (`app/analysis`)
- [ ] Setup (filter chips + date validation), Summary KPIs (distinct reach + generated time + scope), Charts (`recharts`, empty-data banner, denominators for percentages), Export/Share (per-partner result)

**D. Tests:** A01–A06 + share failure retry, percentage denominators, filter scoping

**E. Report:** Section 4, integrated class diagram (AnalysisReport, ReportShare), Figure 4 (UC4 sequence), screenshots NA-1 to NA-4

**F. Final submission (Section 7 of the Group 20 report – "Integration and final submission evidence")**
- [ ] Integration tests, role tests, run instructions, AI prompts appendix, merge final PDF

> **➕ ADDED for Nadeeshan (missing from the original list – from the Group 18 UC4 scenario and our report):**
> - [ ] **Included sections:** `ReportFilters.includedSections` (alerts / reach / reports / shelters / supplies) – Group 18 step 4; unselected sections are omitted from KPIs, charts and PDF
> - [ ] **Report history list** `/analysis/history` (all saved snapshots, newest first) – used by "reopen and share with a new partner" (A2)
> - [ ] **Ground-report tally** (VERIFIED / REJECTED / PENDING within period) – depends on the `ReportDecisionReader` shape (open decision #1, section 20) – agree with Hasaranga on Day 1
> - [ ] **Shelter section uses dated `OccupancyEvent`s**, supplies use dated `Distribution`s – **never** current occupancy as a past value (critique G06)
> - [ ] **Percentages show denominators** ("12 of 20 = 60%"); zero denominator shows "n/a", never `NaN`
> - [ ] **Timeout simulation:** `AggregationService` accepts a timeout from `Clock`/injected deadline; a `SlowReader` fake in tests (A06)
> - [ ] **Share fallback message:** repeated partner failure shows "notify the coordinator by email/phone" and logs it
> - [ ] **Prefill from partner request alternate:** `/analysis?district=...&from=...&to=...` query params prefill the setup form
> - [ ] **Composition & integration:** own `tests/integration/*` (4 contract checks, section 6), `demoScenario.ts` loads through the real services, not by writing rows directly
> - [ ] **Prisma:** `uc4.prisma` (`AnalysisReport.filters/metrics` as `Json`, **no update/delete code path** for snapshots; `ReportShare` one row per partner per attempt), `PrismaSnapshotRepository`, `PrismaShareLogRepository`
> - [ ] **Final PDF owner duties:** keep `docs/ai-prompts.md` complete, make the report's duplicate "Figure 3" numbering consistent (section 20 #11), confirm the same commit SHA is used by code, screenshots and demo

---

## 6. Integration checks (Nadeeshan leads, everyone helps)

| Contract | Must be proven |
|---|---|
| UC2 -> UC1 | Only VERIFIED reports are eligible evidence; unverified report cannot publish a warning |
| UC1 -> UC3 | Issued/escalated alert creates a District Officer notification; UC3 can still open independently |
| UC1 + UC3 -> UC4 | Alerts, attempts, decisions, occupancy and distribution events (shared IDs/times) produce the report |
| Roles | DMC Official issues/reports, Duty Officer verifies, District Officer coordinates, Citizen submits |

**➕ ADDED – where the proof lives:** `tests/integration/uc2-to-uc1.test.ts`, `uc1-to-uc3.test.ts`, `uc134-to-uc4.test.ts`, `roles.test.ts`. They run against **in-memory** repositories wired through `container.ts` (fast, no database). One optional smoke test may run the same flow with `DATA_STORE=prisma` against the local DB.

## 7. Business rules every member must keep

| Rule | Where |
|---|---|
| Unsynced report never appears in officer queue; unverified report cannot publish a warning | UC2, UC1 |
| Every channel attempt has an outcome; reached citizens are **distinct**, not total attempts | UC1, UC4 |
| Supply distribution and shelter occupancy are **independent**; each keeps a dated history | UC3, UC4 |
| Repeated action ID never creates a duplicate; stale version -> visible conflict | UC2, UC3 |
| Saved report snapshot never changes after later updates | UC4 |

---

## 8. Commands

```bash
npm install
npm run dev                  # development (service worker is OFF in dev)
npm run build && npm start   # production mode (test offline/PWA here)
npx vitest run               # all tests

# Coverage for ONE member (replace the folder)
npx vitest run --coverage --coverage.include="src/modules/uc1-warning/**"
```

**➕ ADDED – database and helper commands:**

```bash
npx prisma generate          # regenerate client after any schema change (also runs on npm install)
npx prisma db push           # DEV: sync tables with the schema (no migration files)
npx prisma db seed           # load seed data (idempotent – safe to re-run)
npx prisma db push --force-reset && npx prisma db seed   # wipe and reload the demo data
npx prisma studio            # browse the database in the browser
npx prisma validate          # check all schema/*.prisma files before committing

npm run lint && npm run format:check && npx tsc --noEmit   # run before every PR
```

Suggested `package.json` scripts (Hasaranga adds on Day 1):

```json
{
  "dev": "next dev",
  "build": "prisma generate && next build",
  "start": "next start",
  "lint": "eslint .",
  "format:check": "prettier --check .",
  "test": "vitest run",
  "test:uc1": "vitest run --coverage --coverage.include=\"src/modules/uc1-warning/**\"",
  "test:uc2": "vitest run --coverage --coverage.include=\"src/modules/uc2-report/**\"",
  "test:uc3": "vitest run --coverage --coverage.include=\"src/modules/uc3-resources/**\"",
  "test:uc4": "vitest run --coverage --coverage.include=\"src/modules/uc4-analysis/**\"",
  "test:integration": "vitest run tests/integration",
  "postinstall": "prisma generate"
}
```

## 9. Timeline

| When | Who | What |
|---|---|---|
| **7 Oct evening (0-2 h)** | Hasaranga | Repo, folders, Vitest, PWA -> push |
| | Sandaruwan | Contracts + base infra |
| | Dissanayaka | Shared domain, seed, role switcher |
| | Nadeeshan | Fixtures + UC4 domain/validator |
| **7 Oct night** | All | Approve contracts, pull, start own domain + services + tests |
| **8 Oct morning** | All | Services + unit tests done (80%+) |
| **8 Oct afternoon** | All | 4 UI screens + error states |
| **8 Oct night** | Nadeeshan + all | Integration tests, demo scenario, Vercel deploy check |
| **9 Oct before 12:00** | All | Bug fixes, **CODE FREEZE**, note final commit SHA |
| **9 Oct 12:00 - 6 PM** | All | Screenshots, own report section, UML diagrams, test results |
| **9 Oct 6 - 9 PM** | Nadeeshan | Merge PDF, AI prompts appendix, all four approve |
| **9 Oct before 11:59 PM** | All | **Submit** (do not wait for the last minute) |

**➕ ADDED – Prisma steps inside the same timeline (do NOT add extra days):**

| When | Who | What |
|---|---|---|
| 7 Oct evening | Hasaranga | `prisma.config.ts`, `base.prisma`, docker-compose, `.env.example`, seed entry (part of repo setup) |
| 7 Oct night | Dissanayaka | `shared.prisma` + shared seed so others can `db push` |
| 8 Oct afternoon (after unit tests are green) | Each member | Own `<uc>.prisma` + `adapters/prisma/*` repositories, wire into `container.ts` |
| 8 Oct night | Nadeeshan + Hasaranga | `db push` against Neon, Vercel env var, deploy check, create the single baseline migration |
| **Fallback rule** | All | If a member's Prisma adapter is not ready by **8 Oct 10 PM**, that module stays on `DATA_STORE=memory` for the demo and the report says so (section 12). Never leave `main` broken because of Prisma |

**➕ ADDED – Day-1 blocking order** (who waits for whom):
`Hasaranga repo + tooling (0–2 h)` → `Sandaruwan contracts + infra (2–3 h)` → `Dissanayaka shared domain + seed` → everyone starts. Nadeeshan works in parallel on fixtures (needs only contract types).

## 10. Definition of Done (per member)

- [ ] Main flow, all alternates and all exceptions of my use case work
- [ ] 4 UI screens match the Group 18 wireframes
- [ ] 80%+ coverage with positive, negative, edge and error tests
- [ ] Sequence diagram shows the alternate/exception paths I implemented
- [ ] Screenshots are from the real app at the final commit
- [ ] No `[INSERT]` left in my report section
- [ ] My peer reviewer approved my PR and my report section

**➕ ADDED to the Definition of Done:**

- [ ] Every role/permission rule of my use case is enforced in the **API route** (not only hidden in the UI) and has a test
- [ ] `npx tsc --noEmit`, `npm run lint`, `npx prisma validate` all pass
- [ ] My module works with both `DATA_STORE=memory` and `DATA_STORE=prisma` (or the fallback is written in the report)
- [ ] My report section lists real file paths (section 18) and the coverage number I actually measured (saved in `docs/test-results/`)
- [ ] My AI prompts are appended to `docs/ai-prompts.md` with a note on what I checked or changed

## 11. Final submission checklist

- [ ] First page: Group 20, campus, all four registration numbers
- [ ] One PDF: critique, real screenshots, test results, repository URL, final commit SHA
- [ ] All AI prompts appended with a note on what was checked or changed
- [ ] Repository, screenshots and live demo use the **same commit**
- [ ] No commits after 9 Oct 2026, 11:59 PM

**➕ ADDED:**

- [ ] Campus confirmed (report says **Malabe** – check with the group)
- [ ] Repository is accessible to the marker (public, or marker invited)
- [ ] Live demo URL works from a fresh browser on **the final commit** and is seeded (`db seed` run against the demo DB)
- [ ] Every `[INSERT]`, `[PASTE A REAL APP SCREENSHOT HERE]` and `OWNER ACTION` text is removed from the report
- [ ] Unimplemented items are removed from the report or clearly marked as proposals (the report template says so)

## 12. Known limitations (write these in the report)

- Authentication is out of scope per the assignment spec; a role switcher simulates the four actors.
- Offline reporting needs the app to be opened (installed) **once while online**. Users who never installed it should use the hotline/radio fallback (same as Group 18's design).
- SMS/push gateways, GPS and network state are mocked for the demo.
- ~~In-memory data resets on serverless cold starts on Vercel. Use a free Upstash/Neon store only if a persistent demo is needed.~~
  **➕ UPDATED:** The deployed demo uses **PostgreSQL (Neon) through Prisma**, so data persists across cold starts. Unit tests and `DATA_STORE=memory` use in-memory repositories, which reset on restart. Any module that is still on in-memory at submission time must be listed here.
- **➕ ADDED:** The client-side offline outbox (UC2) is stored in the browser (IndexedDB), not in the database, by design – an unsynced report must never exist centrally.
- **➕ ADDED:** Prisma repository adapters are excluded from the unit-test coverage figure (they are thin mappers); their behaviour (optimistic lock, unique `localId`/`actionId`, transactions) is covered by the in-memory contract tests plus an optional integration smoke test.
- **➕ ADDED:** Wireframe fidelity – screens follow the Group 18 wireframes and the Group 20 required changes; styling is simplified.

---

# New sections (13–21)

## 13. Tech stack & data layer (Prisma) ➕

### 13.1 Stack at a glance

| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | UI + thin API routes |
| Database | **PostgreSQL** | Local via Docker, deployed on Neon (free). SQLite is **not** used – Vercel's disk is read-only/ephemeral and Prisma fixes the provider in the schema |
| ORM | **Prisma 7** (`prisma-client` generator, `@prisma/adapter-pg`) | Config in `prisma.config.ts`; `url` is **not** in the schema file |
| Validation | `zod` | API route inputs |
| Tests | Vitest + v8 coverage | Unit tests use **in-memory fakes, no database** |
| Offline | `@serwist/next` PWA + `idb-keyval` | UC2 outbox |
| Charts / PDF | `recharts` / `pdf-lib` | UC4 |
| Deploy | Vercel + Neon | `DATABASE_URL` pooled connection string |

> Prisma 7 changed setup (driver adapter required, `prisma.config.ts`, no `url` in schema, generated client output path). Hasaranga sets this up once on Day 1; everyone else just runs the commands in section 0/8. If the installed Prisma version differs, follow the official Next.js + Prisma guide at prisma.io/docs/guides/nextjs.

### 13.2 Architecture – why Prisma does not break the rules

```
UI / API route
   │  (zod validation, getActor, requireRole)
   ▼
Service  (plain TS, uses interfaces only)          ← unit-tested with in-memory fakes
   │
   ▼
Repository interface  ◄── InMemoryRepository  (tests, DATA_STORE=memory)
                      ◄── PrismaXRepository   (adapters/prisma/, DATA_STORE=prisma)
```

- Services depend on **interfaces** (`AlertRepository`, `ReportRepository`, ...). They never know whether Prisma or memory is behind them.
- `container.ts` chooses the implementation from `DATA_STORE` and hands it to each module's `createUcXModule(deps)` factory.
- The same contract tests can run against both implementations.

### 13.3 Schema layout (multi-file, one file per owner)

`prisma.config.ts` (Hasaranga):

```ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema",                       // folder with several .prisma files
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url: env("DATABASE_URL") },
});
```

`prisma/schema/base.prisma` (Hasaranga):

```prisma
generator client {
  provider = "prisma-client"
  output   = "../../src/generated/prisma"        // gitignored; created by `prisma generate`
}

datasource db {
  provider = "postgresql"
}
```

`src/shared/infra/prisma/client.ts` (Sandaruwan):

```ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma =
  g.prisma ?? new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
if (process.env.NODE_ENV !== "production") g.prisma = prisma;
```

### 13.4 Migrations policy (avoids merge conflicts between four people)

- **During development:** everyone uses `npx prisma db push` (no migration files, nothing to conflict).
- **One baseline migration** is created by Nadeeshan/Hasaranga on **8 Oct night**: `npx prisma migrate dev --name init`, committed once.
- Against Neon (demo database), run `npx prisma db push` (or `migrate deploy`) **from a laptop once**; do **not** run it inside the Vercel build.
- After the baseline migration, **no schema changes** except agreed bug fixes (announce in the group chat).

### 13.5 Environment variables (`.env.example` – Hasaranga)

```bash
# Local Docker database (docker compose up -d db)
DATABASE_URL="postgresql://dewecs:dewecs@localhost:5432/dewecs?schema=public"

# "prisma" = PostgreSQL via Prisma, "memory" = in-memory repositories (resets on restart)
DATA_STORE=prisma

# Mock gateway behaviour (UC1) – used for demo and failure screenshots
SMS_FAILURE_RATE=0.2
PUSH_FAILURE_RATE=0.1
```

`docker-compose.yml` (Hasaranga): one `db` service, image `postgres:16`, port `5432`, user/password/db `dewecs`, a named volume. Each person may instead use their **own Neon branch** – never share one dev database between four people.

### 13.6 Order of work (important with only two days)

1. Domain + services + **in-memory** repositories + unit tests (must be green first – this is what is graded for tests).
2. UI + API routes working with `DATA_STORE=memory`.
3. Own `<uc>.prisma` + Prisma repositories + mappers, wire into `container.ts`.
4. Switch to `DATA_STORE=prisma`, run seed, re-check the 4 screens.

### 13.7 Coverage configuration (`vitest.config.ts`)

- Provider `v8`; include `src/modules/**` and `src/shared/**`.
- Exclude: `**/__tests__/**`, `**/adapters/prisma/**`, `src/generated/**`, `src/app/**`, `src/components/**`, `**/client/**` browser wrappers that cannot run in Node (cover pure logic like `compressImage` sizing separately).
- Each member reports **their own folder's** coverage using the `npm run test:ucX` scripts and saves the text output to `docs/test-results/ucX-coverage.txt`.

### 13.8 Data-layer rules mapped to the business rules

| Business rule | Where enforced in code | How it is tested |
|---|---|---|
| One central report per `localId` | `GroundReport.localId @unique`; `OutboxSyncService` returns existing row on duplicate (catch Prisma `P2002`) | G03 – sync twice, count rows = 1 |
| Stale version never overwrites | `updateMany({ where:{ id, version: expected }, data:{ …, version:{ increment:1 } } })`; `count === 0` -> `VersionConflictError` | G06, R06 |
| Same `actionId` twice = no duplicate | `ProcessedAction.actionId` is the primary key; check-then-insert inside a transaction | R05 |
| Distribution is atomic | `TransactionRunner.run()` -> `prisma.$transaction`; in-memory impl rolls back | R03 |
| Alert saved **before** dispatch | `WarningService.issue()` awaits `alerts.save()` before any `gateway.send()` | W02 (call-order spy) |
| Snapshot never changes | No update/delete method on `SnapshotRepository`; metrics stored as JSON; domain object `Object.freeze` | A04 |

---

## 14. Domain model & state machines ➕

### 14.1 Entities per module (Prisma models – owner in brackets)

| Module | Model | Key fields / constraints |
|---|---|---|
| **Shared** (Dissanayaka) | `District` | id, name |
| | `RiverBasin` + `BasinDistrict` | basin ⇄ districts (many-to-many, "spans") |
| | `Citizen` | id, name, phone, pushToken, `districtId`, `isVolunteer` |
| | `Officer` | id, name, `role`, `districtId?` (District Officer is bound to a district) |
| | `Organization` | id, name, `type` GOVERNMENT / ARMED_FORCES / NGO / PRIVATE_DONOR, coordinator name + contact |
| **UC1** (Dissanayaka) | `HazardAlert` | id, hazardType, severity, status, message, target (districtIds / basinId), `issuedBy`, `occurredAt` (=issuedAt), `expiresAt`, `cancelledAt?` |
| | `AlertEscalation` | alertId, fromSeverity, toSeverity, occurredAt, byOfficerId (dated history) |
| | `NotificationAttempt` | id, alertId, citizenId, districtId, hazardType, channel PUSH/SMS, status QUEUED/SENT/DELIVERED/FAILED, kind ISSUE/ESCALATION/CANCELLATION, `occurredAt`, sentAt, deliveredAt, failureReason |
| | `DistrictNotification` | id, alertId, districtId, kind ISSUED/ESCALATED, occurredAt, readAt? |
| **UC2** (Hasaranga) | `GroundReport` | id, **`localId` unique**, reporterId, districtId, hazardType, description, lat/lng, `locationSource` GPS/MANUAL_PIN, `gpsAccuracyM`, photo, `confidence` FULL/REDUCED, `reviewStatus`, **`version`**, captureTime, syncTime, severityIndication?, `linkedToReportId?` |
| | `ReportAuditEntry` | id, reportId, action (VERIFIED/REJECTED/NEEDS_INFO/CLARIFIED), officerId?, reason/note, occurredAt, districtId, hazardType |
| **UC3** (Sandaruwan) | `Shelter` | id, districtId, name, capacity, occupancy, status OPEN/FULL, **`version`**, organizationId |
| | `RescueTeam` | id, districtId, name, capability, status, organizationId, currentLocation? |
| | `SupplyStock` | id, organizationId, districtId, supplyType, onHand |
| | `OccupancyEvent` | id, shelterId, districtId, previousCount, newCount, actorId, occurredAt, actionId |
| | `Distribution` | id, stockId, destinationShelterId, quantity, organizationId, actorId, districtId, occurredAt, actionId |
| | `TeamStatusEvent` | id, teamId, from, to, actorId, occurredAt, incident/location |
| | `ProcessedAction` | **actionId (primary key)**, type, resultRef, processedAt |
| | `ConflictQueueItem` | id, actionType, payload (Json), expectedVersion, actualVersion, status OPEN/RESOLVED, createdAt |
| **UC4** (Nadeeshan) | `AnalysisReport` | id, filters (Json), `sourceCutoff`, `generatedAt`, metrics (Json), generatedBy – **write-once** |
| | `ReportShare` | id, reportId, organizationId, status SENT/FAILED, attemptedAt, actorId, failureReason? |

> Every dated table has `occurredAt`, `districtId` and (where relevant) `hazardType` – this is what lets UC4 filter every metric by the same scope.

### 14.2 State machines

**HazardAlert (UC1)**

```
            escalate()                 escalate()
 ACTIVE ───────────────► ESCALATED ───────────────► (error: already max severity)
   │  \                      │
   │   \ cancel()            │ cancel()
   │    ▼                    ▼
   │  CANCELLED ◄────────────┘
   │ expiresAt passed
   ▼
 EXPIRED          (CANCELLED and EXPIRED are closed: escalate/cancel -> error, record unchanged)

 Severity order:  Advisory < Watch < Warning < Emergency    (escalate must go UP; Emergency cannot escalate)
```

**NotificationAttempt (UC1):** `QUEUED → SENT → DELIVERED`  or  `QUEUED/SENT → FAILED` (retry creates a **new** attempt; old FAILED row stays).

**Two separate state machines in UC2 (never mix them):**

```
LocalOutboxEntry (device only):  PENDING_SYNC ⇄ SYNCING → (deleted after central receipt)
                                                   └→ FAILED (retry with SAME localId)
GroundReport.reviewStatus (server): PENDING_REVIEW → VERIFIED
                                         │      └──→ REJECTED (reason required)
                                         └──→ NEEDS_INFO ──(reporter clarifies)──► PENDING_REVIEW
```

**RescueTeam (UC3):** `AVAILABLE → EN_ROUTE → ON_SITE → RETURNING → AVAILABLE` (dispatch only from AVAILABLE; any other jump -> `InvalidTransitionError`).

**Shelter (UC3):** `OPEN` while `occupancy < capacity`; `FULL` when `occupancy == capacity`; `occupancy > capacity` is always rejected.

### 14.3 Rules every service must respect (quick reference)

- Alert targets: districts **or** basin (Kelani = Colombo + Gampaha + Kegalle); resolve to **unique** citizens.
- Preview is labelled **estimated** recipients; the result screen shows **confirmed** delivered / failed per channel and **distinct citizens reached**.
- GPS accuracy > 100 m → manual pin; manual pin records `locationSource=MANUAL_PIN` and the accuracy.
- Duplicate report: same hazard type + within a radius (suggest 500 m) + within a time window (suggest 60 min) → linked, both kept.
- Dispatch to a team owned by another organization needs an explicit `confirmCrossOrg=true`.
- A `Distribution` never changes `Shelter.occupancy`; an `OccupancyEvent` never changes `SupplyStock.onHand`.

---

## 15. Roles & access matrix ➕

The Role Switcher stores the chosen role (and a seeded user) in a cookie. API routes read it with `getActor(request)` and call `requireRole([...])`; denied → **403** and the UI shows "Access denied".

| Capability | Citizen | Duty Officer | DMC Official | District Officer |
|---|:--:|:--:|:--:|:--:|
| Submit ground report, view own outbox / status (`/report/*`) | ✅ | – | – | – |
| Receive alert (`/alerts/[id]` citizen view) | ✅ | – | – | – |
| Review queue: verify / reject / request info (`/officer/reports`) | – | ✅ (own district access) | – | – |
| Preview / issue / escalate / cancel / retry warning (`/warnings`) | – | ❌ | ✅ | – |
| View active warnings (read-only) | – | ✅ | ✅ | ✅ |
| Resource console: dispatch, distribute, update occupancy, register shelter (`/resources`) | – | ❌ | – | ✅ **assigned district only** |
| Generate / export / share analysis (`/analysis`) | – | – | ✅ | – |

Notes:
- **Volunteer** = a Citizen with `isVolunteer=true` (same permissions; the hotline reminder is shown only to non-volunteers).
- **Partner Organisation Coordinator** is **not** a switcher role (Group 18 lists them, but they cannot act in the system in our scope). Partners exist as `Organization` rows used by UC3 (ownership) and UC4 (share targets, notified through `MockPartnerChannel`).
- Read-only visibility for Duty Officer / District Officer on active warnings is our proposal; change only if the team agrees (it does not affect any graded rule).
- Required role tests: Duty Officer cannot issue (UC1), Citizen cannot open the officer queue (UC2), DMC Official cannot dispatch (UC3), District Officer cannot generate reports (UC4), District Officer of district A cannot act on district B.

---

## 16. Pages, API routes, error codes ➕

> Suggested routes. Keep the screen set identical to the four Group 18 screens per use case.

### 16.1 Pages and screenshot mapping

| UC | Route | Screen (Group 18 → Group 20 revision) | Report figure | Group 18 wireframe page* |
|---|---|---|---|---|
| UC1 | `/warnings` (new) | Composer – hazard, target, severity, message, evidence panel | DI-1 | p. 19 |
| UC1 | `/warnings` (step 2) | Preview – "estimated recipients" + zero-recipient confirm | DI-2 | p. 19 |
| UC1 | `/warnings` (result) + `/alerts/[id]` | Delivery result: delivered/failed per channel, distinct citizens, retry | DI-3 | p. 19 |
| UC1 | `/warnings` (active list) | Escalate / cancel, invalid-action reason, new vs old state | DI-4 | p. 19 |
| UC1 | `/alerts/[id]` (citizen) | Citizen alert receipt (phone width) | extra | p. 19 |
| UC2 | `/report/new` | New ground report – validation, manual pin | HA-1 | p. 12 |
| UC2 | `/report/outbox` | Offline queue vs central receipt (separate) | HA-2 | p. 12 |
| UC2 | `/officer/reports` (+ `/[id]`) | Verification console | HA-3 | p. 12 |
| UC2 | `/report/mine` | Reporter result: needs info / verified / rejected + reason | HA-4 | p. 12 |
| UC3 | `/resources` | Dashboard – last refresh + district scope | SA-1 | p. 26 |
| UC3 | `/resources/dispatch` | Dispatch – available teams, ownership, confirm | SA-2 | p. 26 |
| UC3 | `/resources/distribution` | Distribution – stock, quantity validation, saved transaction | SA-3 | p. 26 |
| UC3 | `/resources/shelters` | Shelter status – FULL, alternative, pending/conflict | SA-4 | p. 26 |
| UC4 | `/analysis` | Setup – date validation, filter chips, included sections | NA-1 | p. 33 |
| UC4 | `/analysis/[id]` | Summary KPIs – distinct reach, generated time, scope | NA-2 | p. 33 |
| UC4 | `/analysis/[id]/charts` | Charts / breakdown, empty-data banner, denominators | NA-3 | p. 33 |
| UC4 | `/analysis/[id]/share` + `/analysis/history` | Export PDF + per-partner share result; report history | NA-4 | p. 33 |

\* Physical page numbers of the Group 18 PDF cited in our report (Section 2 findings G08 and the "Interaction design aligned to Group 18" tables). **Open the Group 18 PDF at that page and match the layout before building each screen** (Definition of Done: "4 UI screens match the Group 18 wireframes").

### 16.2 API routes (thin – one service call each)

| UC | Method + path | Calls | Allowed role |
|---|---|---|---|
| UC1 | `POST /api/warnings/preview` | `WarningService.preview` | DMC Official |
| UC1 | `POST /api/warnings` | `issue` (`confirmZeroRecipients` flag) | DMC Official |
| UC1 | `GET /api/warnings` · `GET /api/warnings/[id]` | list / detail (+ attempts summary) | DMC, Duty, District |
| UC1 | `POST /api/warnings/[id]/escalate` | `escalate` | DMC Official |
| UC1 | `POST /api/warnings/[id]/cancel` | `cancel` | DMC Official |
| UC1 | `POST /api/warnings/[id]/retry` | `retryFailed` | DMC Official |
| UC2 | `POST /api/reports` | online submit | Citizen |
| UC2 | `POST /api/reports/sync` | `OutboxSyncService` (by `localId`) | Citizen |
| UC2 | `GET /api/reports/mine` · `POST /api/reports/[id]/clarify` | reporter status / add info | Citizen |
| UC2 | `GET /api/officer/reports` · `GET /api/officer/reports/[id]` | queue / detail | Duty Officer |
| UC2 | `POST /api/officer/reports/[id]/verify` · `/reject` · `/request-info` | `ReviewService` (`expectedVersion` in body) | Duty Officer |
| UC3 | `GET /api/resources/dashboard?districtId=` | `DashboardService` | District Officer |
| UC3 | `POST /api/resources/shelters` | `registerShelter` | District Officer |
| UC3 | `POST /api/resources/shelters/[id]/occupancy` | `updateOccupancy` (`actionId`, `expectedVersion`) | District Officer |
| UC3 | `POST /api/resources/dispatch` | `DispatchService.dispatch` | District Officer |
| UC3 | `POST /api/resources/teams/[id]/status` | team transition | District Officer |
| UC3 | `POST /api/resources/distributions` | `DistributionService.distribute` (`actionId`) | District Officer |
| UC3 | `GET /api/resources/conflicts` · `POST …/[id]/resolve` | `ConflictQueue` | District Officer |
| UC4 | `POST /api/analysis` | `SnapshotService.generate` | DMC Official |
| UC4 | `GET /api/analysis` · `GET /api/analysis/[id]` | history / snapshot | DMC Official |
| UC4 | `GET /api/analysis/[id]/pdf` | `PdfExporter` (from saved snapshot) | DMC Official |
| UC4 | `POST /api/analysis/[id]/share` | `ShareService` (`partnerIds[]`; also used for retry) | DMC Official |

### 16.3 Domain error → HTTP status (same mapping in every route)

| Situation | HTTP | Example error class | UI behaviour |
|---|---|---|---|
| Invalid / missing input | 400 | `ValidationError` (with field list) | highlight fields, keep draft |
| Wrong role / wrong district | 403 | `ForbiddenError` | "Access denied" |
| Record not found | 404 | `NotFoundError` | empty/not-found state |
| Version conflict / duplicate action in progress | 409 | `VersionConflictError` | reload latest, show conflict, no overwrite |
| Business rule rejected (full shelter, insufficient stock, max severity, closed alert, team not AVAILABLE, from > to) | 422 | `AlertNotEscalatableError`, `OverCapacityError`, `InsufficientStockError` … | inline reason + alternative action |
| Timeout / dependency failure | 503 | `AggregationTimeoutError`, `GatewayError` | retry / narrow-filters banner |

Idempotent repeats (same `actionId` / `localId`) return **200 with the original result**, not an error.

---

## 17. Test plan map (IDs → files) ➕

Test IDs come from the Group 20 report. Put the **ID in the test name** (`it("W03: partial SMS failure …")`) so the report table can be filled by searching the ID. Run with `npx vitest run` and keep the output in `docs/test-results/`.

| Owner | IDs | Folder | Must also include (README extras) |
|---|---|---|---|
| Dissanayaka | W01 preview/unique citizens · W02 ACTIVE saved before attempts · W03 partial failure + distinct reach · W04 escalate + district notified again · W05 invalid escalate/cancel no mutation · W06 zero recipients | `src/modules/uc1-warning/__tests__/` | cancel notice, retry, max severity, expired alert, zero citizens, role (Duty cannot issue), target widening without duplicates |
| Hasaranga | G01 missing fields keep draft · G02 offline invisible to officer queue · G03 same `localId` → one report · G04 weak GPS → manual pin / no photo → reduced · G05 clarification & rejection reasons · G06 concurrent decision · G07 only VERIFIED is evidence | `src/modules/uc2-report/__tests__/` | duplicate linking, corrupt photo, clarification flow, permanent sync failure, stale `expectedVersion` |
| Sandaruwan | R01 occupancy ≤ capacity, stock untouched · R02 distribution leaves occupancy untouched · R03 insufficient stock atomic · R04 only AVAILABLE dispatches / return → next dispatch · R05 same `actionId` no duplicate · R06 version conflict queued | `src/modules/uc3-resources/__tests__/` | cross-org confirmation, no team available, full-shelter alternatives, team transitions, register shelter, wrong-district access |
| Nadeeshan | A01 invalid dates rejected, nothing saved · A02 two channels = one citizen · A03 filters scope all metrics, new filter = new snapshot · A04 snapshot unchanged after source change · A05 empty period valid zero report · A06 timeout saves nothing; export/share failure keeps snapshot | `src/modules/uc4-analysis/__tests__/` + `tests/integration/` | share failure retry, percentage denominators (incl. zero), filter scoping per metric, per-channel counts |

**Test conventions (all members):**
- Arrange–Act–Assert; one behaviour per test; descriptive names; use `FakeClock` and `SequentialIdGenerator`.
- Cover **positive, negative, edge, error** for each service; assert the **error class**, not just that something threw.
- Use spies/fakes for gateways and repositories – **never** a real database or network in unit tests.
- For "nothing changes" rules (R03, W05, A01, A06) assert the repository state **before == after**.

---

## 18. Report evidence paths ➕

The Group 20 report has `[INSERT]` fields for repository paths. Use these paths so the report matches the repo:

| Member | Source | Tests | Diagram source | UI routes | Demo data / mocks |
|---|---|---|---|---|---|
| Dissanayaka (UC1) | `src/modules/uc1-warning/` | `src/modules/uc1-warning/__tests__/` | `docs/uml/seq-uc1-warning.puml`, `docs/uml/usecase.puml` | `/warnings`, `/alerts/[id]` | `src/shared/seed/`, `MockSmsGateway`, `MockPushGateway` (failure rate via `.env`) |
| Hasaranga (UC2) | `src/modules/uc2-report/` | `src/modules/uc2-report/__tests__/` | `docs/uml/seq-uc2-report.puml`, `docs/uml/class-reports-alerts.puml` | `/report/new`, `/report/outbox`, `/report/mine`, `/officer/reports` | "Simulate Offline" toggle, mocked GPS accuracy, seeded reporters |
| Sandaruwan (UC3) | `src/modules/uc3-resources/` | `src/modules/uc3-resources/__tests__/` | `docs/uml/seq-uc3-resources.puml`, `docs/uml/class-resources.puml` | `/resources`, `/resources/dispatch`, `/resources/distribution`, `/resources/shelters` | `uc3-resources/seed/` (shelters, teams, stock per organization) |
| Nadeeshan (UC4) | `src/modules/uc4-analysis/` | `src/modules/uc4-analysis/__tests__/`, `tests/integration/` | `docs/uml/seq-uc4-analysis.puml`, `docs/uml/class-integrated.puml` | `/analysis`, `/analysis/[id]`, `/analysis/[id]/charts`, `/analysis/[id]/share`, `/analysis/history` | `src/shared/seed/demoScenario.ts`, `MockPartnerChannel` |

Report-wide items: repository URL + **full 40-character commit SHA**, run instructions (= section 0), test proof (= `docs/test-results/*`), UML source (= `docs/uml/*`).

Figure numbering used in this README (from the report): **Fig 1** use case · **Fig 2** class (reports/alerts/delivery) · **Fig 3** class (shelter/team/stock) · **Fig 4** UC4 sequence · **Fig 5** UC3 sequence · **Fig 6** UC2 sequence · UC1 sequence is also numbered "Figure 3" in the report (see section 20 #11).

---

## 19. Git workflow & PR checklist ➕

1. `git checkout main && git pull` → `git checkout -b feat/ucX-<topic>` (the four long-lived branches in rule 6 may also have short sub-branches).
2. Small commits, message `ucX: <what>` (shared work: `shared: …`, `infra: …`, `docs: …`).
3. Before opening a PR: `npx tsc --noEmit && npm run lint && npx vitest run && npx prisma validate`.
4. PR into `main`; the **peer reviewer** (section 1) approves. Reviewer checks the list below.
5. Merge with **squash** after approval; delete the branch. Pull `main` into your branch daily (at least every morning and before the freeze).
6. After **9 Oct 12:00** only bug-fix PRs; note the final commit SHA in the group chat and in the report. **Nothing after 11:59 PM.**

**PR checklist (reviewer ticks every box):**
- [ ] Only the author's folders changed (or the owner agreed)
- [ ] No cross-module imports (only `shared/contracts`); Prisma only inside `adapters/prisma`
- [ ] New logic has positive / negative / edge / error tests with test IDs where applicable
- [ ] Business rules from section 7 still hold; role checks are in the API route
- [ ] No `console.log`, commented-out code, `any`, `.env` or secrets
- [ ] UI matches the Group 18 wireframe + the Group 20 required changes; error and empty states exist
- [ ] Screenshots / report text (if included) match the code

**Code-quality checklist (rubric: 20 marks):** single-responsibility classes, constructor injection, interfaces for every external dependency, typed errors, small functions, meaningful names, short doc comment on every public service method, patterns used where natural (Repository, Strategy for channels, State for alert/team transitions, Factory in `createUcXModule`, Adapter for mock gateways).

---

## 20. Open decisions / gaps to confirm (Day 1 meeting) ➕

These came from comparing the README with the Group 18 design, the Group 20 report and the spec. Each has a proposed default so nobody is blocked.

| # | Gap found | Proposed default | Owner |
|---|---|---|---|
| 1 | UC4 must tally ground reports as VERIFIED / REJECTED / **PENDING** (Group 18 step 9), but `ReportDecisionReader` only suggests decisions | `listDecisions` returns one row per **central** report with its latest `reviewStatus` (including PENDING_REVIEW / NEEDS_INFO) and its decision time | Hasaranga + Nadeeshan |
| 2 | UC3 "Activate shelter" (register shelter) is a main-flow step but not in the task list | Added to Sandaruwan (`registerShelter`) | Sandaruwan |
| 3 | EXPIRED alert state has no trigger | `expiresAt` + `expireDueAlerts()` using `Clock` | Dissanayaka |
| 4 | Escalation "expand target if justified" | `escalate(alertId, severity, expandTo?)` resends to old + new unique citizens | Dissanayaka |
| 5 | Roles: Group 18 also has Volunteer and Partner Coordinator | Volunteer = flag on Citizen; Partner = `Organization` row (not a switcher role) | Dissanayaka |
| 6 | Hazard types differ (UC1: 4 types, UC2: includes "Other") | One shared `HazardType` enum; `OTHER` only in ground reports | Dissanayaka |
| 7 | UC4 "included sections" and report history (Group 18 steps 4, "reopen") | Added to Nadeeshan | Nadeeshan |
| 8 | Atomic stock update must work with a real DB | `TransactionRunner` interface (memory + Prisma) | Sandaruwan |
| 9 | Migrations from four people will conflict | `db push` in dev; one baseline migration on 8 Oct night | Hasaranga |
| 10 | Who wires modules together without breaking the "no direct import" rule | `container.ts` composition root (only file allowed to import several modules) | Sandaruwan |
| 11 | Group 20 report numbers two different figures as **"Figure 3"** (shelter class diagram and UC1 sequence) | Rename UC1 sequence to **Figure 3a** (or renumber all) when merging the PDF; README keeps the report numbers until then | Nadeeshan |
| 12 | Report says "**Malabe**" campus – template says "confirm campus" | Confirm before PDF merge | All |
| 13 | The Group 18 wireframes/sequence diagrams are **images** inside the PDF (not text) | Open the PDF pages in section 16.1 and copy the layouts; sequence diagrams must be **redrawn** in `docs/uml` showing alt/opt/loop fragments for our implemented alternates/exceptions (the report's OWNER ACTION) | Each member |
| 14 | Spec: *"suggested changes in the report are followed exactly in the implementation"* | Every critique item G01–G08 must be visible in code/UI: G01 (conditional evidence flows), G02 (two state machines), G03 (attempt statuses), G04 (distinct reach), G05 (independent occupancy/supply), G06 (dated events + snapshots), G07 (versions/actionIds), G08 (error/empty/retry states). Use the table in 20.1 as the final check | All |
| 15 | Spec: avoid login/logout/admin privilege grants | Role Switcher only; do not spend time on auth | All |

### 20.1 Critique → implementation traceability (for the "follow the report exactly" rule)

| Finding | What the report requires | Where it must be visible |
|---|---|---|
| G01 | Optional photo/GPS/offline as conditional flows; actor attached only where it participates | UC2 form fallbacks; use case diagram |
| G02 | Local outbox status ≠ server review status; unsynced report not in officer queue; idempotent `localId` | `LocalOutboxEntry` vs `GroundReport`; G02/G03 tests; `/report/outbox` |
| G03 | Queued/sent/delivered/failed per channel; audio only after receipt; partial failure feedback | `NotificationAttempt`; result screen; citizen receipt |
| G04 | Distinct citizens with ≥ 1 delivered attempt; per-channel shown separately | `ReachCalculator`; UC4 KPIs; UC1 result |
| G05 | Occupancy and supply are independent commands with separate audit events | `ShelterService` vs `DistributionService`; R01/R02 |
| G06 | Dated `Distribution`/`OccupancyEvent`; snapshot with filters + cutoff; `ReportShare` log | UC3 events; `AnalysisReport`; `ReportShare` |
| G07 | Versions + idempotent action IDs; conflicts kept for review; pending/failed/confirmed visible | `version`, `ProcessedActionStore`, `ConflictQueue`; SA-4 |
| G08 | Inline validation, accessible status text, error details, retry/alternative actions | Every screen: validation, empty, error, retry states; status shown as **text** (not colour only) |

---

## 21. Troubleshooting ➕

| Problem | Fix |
|---|---|
| `Cannot find module '@/generated/prisma/client'` | Run `npx prisma generate` (also happens on `npm install`) |
| `Environment variable not found: DATABASE_URL` | Create `.env` from `.env.example`; make sure `prisma.config.ts` starts with `import "dotenv/config"` |
| `P1001 Can't reach database server` | `docker compose up -d db`, check the port, or paste your Neon pooled URL |
| Schema changed but tables are old | `npx prisma db push` (add `--force-reset` to wipe) then `npx prisma db seed` |
| Two of us changed the same `.prisma` file | You edited someone else's file – revert; ask the owner (rule 10) |
| Tests fail only on Prisma | Unit tests must not import Prisma – move that import into `adapters/prisma/` |
| PWA / offline not working in `npm run dev` | The service worker is OFF in dev – use `npm run build && npm start` |
| Data disappeared after Vercel redeploy | You are on `DATA_STORE=memory`; set `DATA_STORE=prisma` + `DATABASE_URL` in Vercel env vars |
| Vercel build fails on Prisma | Build script must be `prisma generate && next build`; set `DATABASE_URL` in Vercel; do not run `db push` in the build |
| Role guard shows "Access denied" for everyone | Pick a role in the top-bar Role Switcher (cookie missing) |
| Coverage shows 0% for my module | Run the module script (`npm run test:ucX`) and check the `--coverage.include` path |
