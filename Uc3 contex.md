# UC3 CONTEXT: Coordinate Emergency Resources (Sandaruwan, IT23633322)

> Authoritative context for the AI agent working on **my scope only**.
> Place this file at `src/modules/uc3-resources/CONTEXT.md`.
> Read order: `AGENTS.md` -> `README.md` (Case_Study_Readme) -> this file.
> If this file and README disagree about UC3, follow this file and tell me about the conflict. Never guess silently.

---

## 1. Project snapshot

| Item | Value |
|---|---|
| Project | DEWECS - Smart Disaster Early-Warning and Emergency Coordination System (Sri Lanka) |
| Course | SE3070 Assignment 02, Group 20 (implements the Group 18 Assignment 01 design with Group 20's improvements) |
| Repo | https://github.com/Hasaranga22/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System |
| Stack | Next.js 16 (App Router) + TypeScript (strict) + Prisma 7 + PostgreSQL + Vitest (v8 coverage) + Tailwind |
| Code freeze | 9 Oct 2026, 12:00 noon (bug fixes only after). Hard deadline 9 Oct 2026, 11:59 PM |
| Grading of my part | Implementation accuracy vs report (30), Code quality and best practices (20), Unit tests >80% coverage (20) |

**Next.js 16 and Prisma 7 have breaking changes.** Before writing any Next.js or Prisma code, read the relevant guide in `node_modules/next/dist/docs/` and the Prisma 7 notes in README section 13. Check how route handler `params` and `cookies()` work (they may be async). Do not rely on memory.

**Repo state when this file was written:** only README, `prisma/schema/*.prisma`, a seed stub, `prisma.config.ts`, `vitest.config.ts`, `docker-compose.yml` exist. `src/modules`, `src/shared/contracts`, `src/shared/infra` do not exist yet.

---

## 2. Who I am and what I own

**SANDARUWAN H M K (IT23633322)**, UC3 owner. Peer reviewer: Hasaranga reviews me; I review Nadeeshan.

### Folders I MAY edit
- `src/modules/uc3-resources/**`
- `src/app/resources/**` (pages) and `src/app/api/resources/**` (routes)
- `src/shared/contracts/**` and `src/shared/infra/**` (shared work I own)
- `prisma/schema/uc3.prisma`

### Folders I MUST NOT edit (ask the owner)
- `prisma/schema/shared.prisma`, `uc1.prisma` (Dissanayaka), `uc2.prisma`, `base.prisma`, root config (`package.json`, `tsconfig`, `vitest.config.ts`, ESLint/Prettier, `docker-compose.yml`, `prisma.config.ts`) (Hasaranga), `uc4.prisma`, `docs/` final PDF, `tests/integration/` (Nadeeshan)
- Other modules: `uc1-warning`, `uc2-report`, `uc4-analysis`
- `src/shared/domain`, `src/shared/access`, `src/shared/seed`, `RoleSwitcher`, `layout.tsx` (Dissanayaka)
- **No new npm dependencies.** If one is truly needed, stop and tell me (package.json belongs to Hasaranga).
- Allowed single-line touches, always reported to me: register UC3 in `src/shared/infra/container.ts`; call `buildUc3Seed` from `prisma/seed.ts`.

### Git
Branches: `feat/uc3-shared-contracts` (Phase 0, merge first, everyone is blocked on it) then `feat/uc3-resources`. Commit messages: `uc3: ...`, `shared: ...`, `infra: ...`, `docs: ...`. No direct push to `main`.

---

## 3. Architecture rules (from README section 2, 3, 13)

1. Layers: `UI -> API route -> Service -> Repository / Adapter`.
2. Dependency direction (never reversed):
   `app/ -> modules/uc3-resources/index.ts -> services -> domain`, services use adapter **interfaces**; `modules/* -> shared/contracts, shared/domain, shared/infra` allowed; `modules/ucX -> modules/ucY` **forbidden** (use contracts); only `container.ts` may import several modules.
3. Business logic = plain TypeScript classes. No Next.js, no browser APIs, no `process.env`, no Prisma inside `domain/` or `services/`.
4. Prisma only inside `adapters/prisma/` and `src/shared/infra/prisma/`. Unit tests never import Prisma.
5. No Prisma relations to other modules' tables. Reference by plain string ids. Relations to shared tables (`District`, `Officer`, `Organization`) are allowed.
6. Time and ids are injected: never `new Date()`, `Date.now()`, `crypto.randomUUID()` in domain/services. Use `Clock` and `IdGenerator`.
7. Typed domain errors only (never `throw new Error("...")`).
8. API routes: validate with `zod`, call exactly ONE service method, map errors with the shared mapper. No business logic in routes or components.
9. Storage-touching contracts return `Promise<...>` (Prisma is async). README's sync signatures are outdated; the contracts I write must be async.
10. Role checks are enforced in the API route AND re-checked in the service policy (not only hidden in the UI).
11. Build order (README 13.6): domain + services + in-memory + unit tests green FIRST; then UI/API on `DATA_STORE=memory`; then Prisma adapters; then `DATA_STORE=prisma`.
12. No login/signup. Role Switcher cookie only (`getActor`, `requireRole` from `@/shared/access`, owned by Dissanayaka).

---

## 4. Domain model (maps to `prisma/schema/uc3.prisma`)

IDs are UUID strings (schema uses `@db.Uuid`). The test `SequentialIdGenerator` must produce UUID-shaped ids, e.g. `00000000-0000-4000-8000-000000000001`.

| Entity | Fields | Invariants |
|---|---|---|
| **Shelter** | id, districtId, organizationId, name, address, latitude?, longitude?, capacity, occupancy, status `OPEN\|FULL`, version | `0 <= occupancy <= capacity`; status is FULL **iff** `occupancy === capacity`; version +1 on every change |
| **RescueTeam** | id, districtId (= HOME district, never changes), organizationId, name, capability, status, currentLatitude?, currentLongitude?, **version (to add)** | legal transitions only (section 5) |
| **SupplyStock** | id, organizationId, districtId, supplyType, onHand, **version (to add)** | `onHand >= 0` |
| **OccupancyEvent** | id, shelterId, districtId, previousCount, newCount, actorId, occurredAt, actionId | immutable, dated |
| **Distribution** | id, stockId, destinationShelterId, organizationId, districtId, quantity, actorId, occurredAt, actionId | immutable, dated, quantity > 0 |
| **TeamStatusEvent** | id, teamId, fromStatus, toStatus, actorId, occurredAt, incident?, location? | immutable |
| **ProcessedAction** | actionId (PK), type, resultRef?, processedAt | one row per actionId |
| **ConflictQueueItem** | id, actionType, payload (Json, includes districtId + original input), expectedVersion, actualVersion, status `OPEN\|RESOLVED`, createdAt, resolvedAt?, resolvedBy? | never silently overwritten |
| **DispatchRequest (to add)** | id, districtId (plain uuid, NO relation), incident?, location, requestedBy, status `UNASSIGNED\|ASSIGNED\|CANCELLED`, teamId?, actionId, occurredAt | created when no team is available (E2) |

### Schema changes I must make in `uc3.prisma` (only this file)
- add `version Int @default(0)` to `RescueTeam` and `SupplyStock`
- add `enum DispatchRequestStatus` and `model DispatchRequest` mapped to `dispatch_request`, **no `@relation`** (avoids editing `shared.prisma`)
- run `npx prisma validate`; tell the group the table count changes from 24 to 25

### Contracts I own (`src/shared/contracts`, frozen after Day-1 approval)
`VerifiedEvidenceProvider`, `DistrictNotificationStore`, `AlertReader`, `AttemptReader`, `ReportDecisionReader`, `OccupancyEventReader`, `DistributionReader`, `Clock`, `IdGenerator`, `Filter`, `types.ts` (`HazardType`, `Filter`, `VerifiedEvidence`, `DistrictNotification`, `ReportDecision`, `Actor`, minimal `HazardAlert`, `NotificationAttempt`, `OccupancyEvent`, `Distribution` each exposing at least `{id, occurredAt, districtId, hazardType?}`).
`Actor = { id: string; role: 'CITIZEN'|'DUTY_OFFICER'|'DMC_OFFICIAL'|'DISTRICT_OFFICER'; districtId?: string }`.
`Filter = { from?, to?, districtId?, hazardType?, cutoff? }`: `from/to` inclusive on `occurredAt`; `cutoff` keeps `occurredAt <= cutoff`.
UC3 readers return **dated rows, never current totals**, and ignore `hazardType` (document this in JSDoc).

---

## 5. State machine (State pattern)

```
RescueTeam:  AVAILABLE -> EN_ROUTE -> ON_SITE -> RETURNING -> AVAILABLE
```
- Dispatch is allowed **only** from AVAILABLE. Any other jump throws `InvalidTransitionError`.
- **Naming:** the Group 20 report text says `DISPATCHED`; code, schema and README use `EN_ROUTE`. In the report, "DISPATCHED" means EN_ROUTE/ON_SITE. Use `EN_ROUTE` in all code, tests, diagrams.
- Shelter OPEN/FULL is a **derived** value (`occupancy === capacity`). Do not build a state machine for it.

---

## 6. Business rules (must hold; each needs a test)

1. Only `DISTRICT_OFFICER` may register shelters, dispatch teams, update occupancy, log distributions, and only inside their assigned district (`actor.districtId`). DMC Official, Duty Officer, Citizen are denied. District A cannot act on district B.
2. A team can be dispatched only while AVAILABLE; it must pass RETURNING back to AVAILABLE before the next dispatch.
3. Stock and occupancy never go negative; occupancy never exceeds capacity; a shelter at capacity is FULL.
4. **Distribution and occupancy are independent commands** (G05, G06). A `Distribution` never changes `Shelter.occupancy`; an `OccupancyEvent` never changes `SupplyStock.onHand`. Neither service calls the other. Each keeps its own dated record.
5. **A distribution is all-or-nothing** (G09): the stock decrement and the `Distribution` record commit together or not at all, via `TransactionRunner`.
6. **Every state-changing action carries a unique `actionId` and the record `version` seen** (G07). Same `actionId` again returns the ORIGINAL result (HTTP 200), never a duplicate and never an error. A stale version becomes a visible conflict in the `ConflictQueue`, never a silent overwrite.
7. **Cross-district dispatch** (G10, A5) needs explicit officer confirmation (`confirmCrossDistrict`); the team's home `districtId` never changes, so it rejoins its home pool on return.
8. **Cross-organization dispatch** needs `confirmCrossOrg`. Assumption (confirm with group): a team whose owning organization type is not `GOVERNMENT` is partner-owned and needs confirmation. If both cross-org and cross-district apply, the UI shows ONE combined confirmation.
9. Partner Organisation self-service is OUT of scope (G11). Partners are pre-registered inputs only.
10. Team status is system-set and read-only in the UI; no manual stock-confirm checkbox; no Deactivate Shelter button (G12).

---

## 7. Use case scenario (revised, condensed from the Group 20 report, Section 5)

**Main flow**
1. Open district resource dashboard (for an active warning or routine need); it shows last refresh time.
2. Review shelter capacity, occupancy, team state, on-hand stock.
3. Explicitly update shelter occupancy (absolute number); reject values above capacity or below zero.
4. Select an AVAILABLE team; confirm dispatch and record incident/location; team becomes EN_ROUTE.
5. Record the team's return: RETURNING, then AVAILABLE at base.
6. Select stock, destination, quantity; system validates balance and saves the Distribution and stock decrement in one transaction.
7. Refresh dashboard; audit each actor, timestamp, status.

**Alternates**
- **A1** triggered by an escalated UC1 warning, district preselected (read `DistrictNotificationStore`).
- **A2** team returns: RETURNING then AVAILABLE; dispatchable again.
- **A3** cross-organization team: owning partner confirmed before dispatch (one combined confirmation with A5 if both apply).
- **A4** offline: actions queued with `actionId` + seen `version`; on sync a matching version applies once, a stale version goes to E4; queued actions show PENDING.
- **A5** no team in home district: officer confirms backup request and dispatches an AVAILABLE adjacent-district team; `homeDistrictId` unchanged; stale team version follows E4.
- **A6** overflow/new need: activate a new shelter (name, location, capacity, owning organisation), created with occupancy 0 and version 0.

**Exceptions**
- **E1** full shelter: reject the over-capacity update, show FULL, suggest A6 or another open shelter (`OverCapacityError.alternatives`).
- **E2** no team in home district: offer A5; if none anywhere, save a `DispatchRequest` as UNASSIGNED until a team becomes AVAILABLE.
- **E3** stock shortfall or any failure during distribution: roll back the whole transaction; UI says "Insufficient stock - nothing was recorded".
- **E4** version conflict or save failure: preserve input, enqueue conflict for review, never overwrite.
- **E5** invalid occupancy or quantity (negative, zero, non-numeric): reject inline, keep input, change nothing.

**Postcondition:** resource state and dated action history agree; pending offline actions remain visibly unconfirmed.

---

## 8. Services and responsibilities (one reason to change each)

| Class | Responsibility | Must NOT |
|---|---|---|
| `ResourceAccessPolicy` | role + district scope check -> `ForbiddenError` | contain business rules |
| `ProcessedActionStore` | find/record `actionId`, replay original result | know about shelters/teams |
| `IdempotentCommandExecutor` | access check -> replay check -> execute -> record (written ONCE, composition, no inheritance) | be duplicated per service |
| `ConflictQueue` | enqueue, listOpen(districtId), resolve(`RETRY`/`DISCARD`) | apply changes silently |
| `ShelterService` | `registerShelter`, `updateOccupancy` (absolute `newCount`, `expectedVersion`) | touch SupplyStock |
| `DispatchService` | `dispatch`, `findBackupTeams`, `advanceTeam`; runs confirmation rules as Strategy objects; writes `TeamStatusEvent`; notifies owning org coordinator via `PartnerNotifier` | contain `switch` on status |
| `DistributionService` | `distribute` inside `TransactionRunner` | touch Shelter occupancy |
| `DashboardService` | `getDashboard(actor, districtId)`: shelters, teams, stock grouped by owning organisation, open conflicts, UNASSIGNED requests, `lastRefreshedAt`, `preselectedFromAlert` | mutate state |
| `OccupancyEventQueryService`, `DistributionQueryService` | implement the UC4 readers | return totals instead of dated rows |

Ports with mock adapters: `PartnerNotifier` (-> `LoggingPartnerNotifier`), `DistrictAdjacency` (-> `StaticDistrictAdjacency`: Colombo, Gampaha, Kegalle adjacent; the repo has no adjacency model, G10).

Commands (parameter objects, max 3 params per function): `UpdateOccupancyCommand`, `DispatchTeamCommand`, `DistributeSupplyCommand`, each with `actionId`, `actor`, and the version where relevant.

---

## 9. API routes and error mapping

All under `src/app/api/resources/`, role `DISTRICT_OFFICER`, assigned district only.

| Method + path | Service call |
|---|---|
| `GET /dashboard?districtId=` | `DashboardService.getDashboard` |
| `POST /shelters` | `registerShelter` |
| `POST /shelters/[id]/occupancy` | `updateOccupancy` (`actionId`, `expectedVersion`) |
| `POST /dispatch` | `DispatchService.dispatch` |
| `GET /dispatch/backup-teams?districtId=` | `findBackupTeams` |
| `POST /teams/[id]/status` | `advanceTeam` |
| `POST /distributions` | `DistributionService.distribute` (`actionId`) |
| `GET /conflicts`, `POST /conflicts/[id]/resolve` | `ConflictQueue` |

| Situation | HTTP | Error class |
|---|---|---|
| invalid input | 400 | `ValidationError` |
| wrong role / wrong district | 403 | `ForbiddenError` |
| not found | 404 | `NotFoundError` |
| stale version | 409 | `VersionConflictError` |
| business rule (full shelter, stock, team not available, bad transition, confirmation required) | 422 | subclasses of `BusinessRuleError` |
| dependency failure | 503 | `DependencyError` |
| idempotent repeat | 200 | original result |

Unknown errors map to 500 with no internal details leaked.

---

## 10. UI (4 screens, match Group 18 wireframes p.26 + Group 20 changes)

Responsive web UI (desktop/tablet first, usable on a phone). Web dashboard, **not** a native mobile app. Tailwind only.

| Screen | Route | Report fig | Required behaviour |
|---|---|---|---|
| Dashboard | `/resources` | SA-1 | last refresh, district scope, KPI tiles, shelters/teams/stock tables, stock grouped by owning org, Activate Shelter modal (A6), conflict + UNASSIGNED banners, preselected-district banner (A1) |
| Dispatch | `/resources/dispatch` | SA-2 | AVAILABLE teams with capability + ownership, destination confirm, combined cross-org/cross-district confirmation, system-set read-only status, backup request flow (A5) |
| Distribution | `/resources/distribution` | SA-3 | available stock by org, live quantity validation, no manual stock tick, saved-transaction receipt |
| Shelter status | `/resources/shelters` | SA-4 | absolute occupancy update, FULL state + alternative shelters, PENDING/CONFIRMED/CONFLICT states, conflict review (Retry/Discard) |

**G08 rules on every screen:** inline validation, status shown as **text** (not colour only), error details plus a retry or alternative action, loading and empty states.
**Idempotency in the browser:** `actionId = crypto.randomUUID()` in client code; a retry REUSES the same id. Offline queue + "Simulate offline" toggle live in `client/` (browser-only, injectable storage, pure queue logic unit-tested).

---

## 11. Tests (Vitest, in-memory only, no DB, no network)

Test id goes in the test name: `it("R03: insufficient stock rejects and changes nothing", ...)`.

| ID | Behaviour |
|---|---|
| R01 | 100/100 shelter rejects 101, stays FULL, stock untouched. And 90/100 -> 150 rejected, stays OPEN, alternatives listed |
| R02 | distribution records quantity + destination, occupancy unchanged |
| R03 | insufficient stock rejects, stock and distributions unchanged |
| R04 | only AVAILABLE dispatches; RETURNING -> AVAILABLE allows next dispatch; no team -> UNASSIGNED saved |
| R05 | same `actionId` twice (occupancy, dispatch, distribution) -> exactly one record, same result |
| R06 | stale version -> conflict queued, newer value not overwritten |
| R07 | cross-district backup needs confirmation; home districtId unchanged; returns to home pool |
| R08 | forced failure after stock decrement (injected failing repository) -> stock, distributions, processed actions all rolled back |
| R09 | registerShelter -> occupancy 0, version 0, visible on dashboard |
| R10 | negative/non-integer occupancy and zero/negative/non-numeric quantity rejected, no state change |

Also required: cross-org confirmation, invalid team transitions, wrong-district and wrong-role access, conflict RETRY/DISCARD, reader filters (from/to/district/cutoff), dashboard preselection from `DistrictNotificationStore`, seed builder, `createUc3Module` factory, each `TeamState`, each dispatch rule, `IdempotentCommandExecutor`, value-object validators.

**Conventions:** Arrange-Act-Assert; one behaviour per test; `FakeClock` + `SequentialIdGenerator`; builders/fixtures instead of copy-pasted setup; no loops or logic in tests; assert the **error class**; for "nothing changes" rules assert repository state before == after; cover positive, negative, edge, error.

**Coverage gotcha:** `npm run test:uc3` measures `src/modules/uc3-resources/**`. Excluded: `__tests__`, `adapters/prisma`, `src/app`, `src/components`, `**/client/**`. Everything else counts, **including `seed/` and `index.ts`**, so both need tests. Target >= 85%. Save output to `docs/test-results/uc3-coverage.txt`.

---

## 12. Code quality standard (graded: 20 marks)

### 12.1 Coding standards
- TypeScript strict; explicit return types on public methods; `readonly` by default; immutable updates (return new objects, do not mutate inputs).
- No `any`, no non-null `!`, no `console.log`, no commented-out code, no leftover TODO, no unused imports/exports.
- One concept for a status/type: pick enum OR string-literal union, not both.
- Naming: PascalCase classes/types, camelCase functions, UPPER_SNAKE constants; file named after its single main export; intention-revealing names (never `data`, `tmp`, `util`, `handle`).
- JSDoc on every exported class/function: purpose, `@param`, `@returns`, `@throws` (typed errors). Comments explain WHY only. Pattern-based files get a one-line header naming the pattern.
- Guard clauses and early returns; max nesting depth 3.

### 12.2 Measurable limits
| Metric | Limit |
|---|---|
| function length | <= 25 lines |
| file length | <= 200 lines |
| cyclomatic complexity | <= 8 |
| parameters | <= 3 (use command objects) |
| duplicated blocks | 0 clones (jscpd, min 6 lines) |
| circular dependencies | 0 (madge) |
| coverage | >= 85% statements and branches |

### 12.3 SOLID (must be visible and provable)
- **S**: separate classes per section 8; none does two jobs.
- **O**: a new dispatch rule, team state or repository = a new class; no edits to existing ones.
- **L**: in-memory and Prisma repositories are substitutable behind one interface; the same contract test suite runs against every implementation that needs no DB.
- **I**: small interfaces; readers are separate from write repositories; a service receives only the ports it uses.
- **D**: services depend on interfaces + injected `Clock`, `IdGenerator`, `TransactionRunner`; concretes are wired only in `index.ts` / `container.ts`.

### 12.4 Design patterns (use only where they genuinely fit; be able to explain each in a viva)
| Pattern | Where | Why |
|---|---|---|
| State | RescueTeam (`AvailableState`, `EnRouteState`, `OnSiteState`, `ReturningState` implementing `TeamState`) | replaces status if/else chains |
| Repository | one interface per aggregate, in-memory + Prisma | hides storage |
| Unit of Work | `TransactionRunner` | atomic multi-step writes (G09) |
| Strategy | dispatch confirmation rules (`CrossOrganizationRule`, `CrossDistrictRule`) | Open/Closed |
| Composition pipeline | `IdempotentCommandExecutor` | idempotency logic exists exactly once |
| Factory | `createUc3Module(deps)` | single wiring point |
| Adapter / Port | `PartnerNotifier`, `DistrictAdjacency` | mockable externals |
| Command / Parameter object | `*Command` types | short signatures |
| Value object | `Quantity`, `OccupancyCount` | validate once, avoid primitive obsession |

### 12.5 Code-smell checklist (hunt and remove)
God class, long method, long parameter list, deep nesting, duplicated code, magic numbers/strings, primitive obsession, data clumps, feature envy (logic belongs on the entity), anemic domain model (entities own their invariants), switch/if-chains on type or status, shotgun surgery, speculative generality, dead code, boolean-flag parameters, mutable shared state, plain `Error("...")`, comments that restate code, catch-and-ignore.

### 12.6 Quality gates (run after every phase; do not continue until clean)
```bash
npx tsc --noEmit
npm run lint
npm run format:check            # npx prettier --write on my folders if it fails
npm run test:uc3                # >= 85%
npx prisma validate
npx eslint src/modules/uc3-resources --rule '{"complexity":["error",8],"max-lines-per-function":["error",25],"max-depth":["error",3],"max-params":["error",3],"no-magic-numbers":["warn",{"ignore":[0,1,-1]}]}'
npx jscpd src/modules/uc3-resources --min-lines 6 --reporters console
npx madge --circular --extensions ts src/modules/uc3-resources
grep -rn "new Date\|Date.now\|randomUUID\|console.log\|@prisma\|: any" src/modules/uc3-resources/domain src/modules/uc3-resources/services
```
The last grep must print nothing.

---

### 12.7 Refactoring: workflow and technique catalogue

**Workflow (follow it, do not rewrite code in big jumps):**
1. Write or keep a test that pins the current behaviour (characterization test). Never refactor code that has no test.
2. Run tests: they must be green BEFORE you start.
3. Apply ONE refactoring technique at a time (small step).
4. Run tests again: still green. If red, undo the step; do not "fix forward".
5. Commit each refactoring separately: `uc3: refactor - extract method validateQuantity`.
6. Repeat. Behaviour must never change during a refactoring; new behaviour is a separate commit with its own test.
7. Log every non-trivial refactoring in `docs/code-quality-audit.md` (smell -> technique -> file -> before/after).

**Smell -> refactoring technique (use these exact names in the audit log):**

| Smell | Refactoring technique | UC3 example |
|---|---|---|
| Long method | **Extract Method** | split `updateOccupancy` into `assertWithinCapacity`, `buildOccupancyEvent`, `persistAtomically` |
| Switch / if-chain on status or type | **Replace Conditional with Polymorphism** (State / Strategy) | `RescueTeam` status checks -> `TeamState` classes; dispatch confirmations -> `DispatchRule` classes |
| Duplicated code | **Extract Method / Extract Class / Pull Up** | idempotency check repeated in 3 services -> `IdempotentCommandExecutor` |
| Long parameter list | **Introduce Parameter Object** | `updateOccupancy(a, b, c, d, e)` -> `UpdateOccupancyCommand` |
| Primitive obsession | **Replace Primitive with Object** | raw `number` quantity -> `Quantity` value object that validates once |
| Magic number / string | **Replace Magic Number with Named Constant** | `'EN_ROUTE'`, `0.2`, error codes -> one constant/enum |
| Feature envy (service pokes entity fields) | **Move Method** | occupancy bound check moves from `ShelterService` into `Shelter.withOccupancy()` |
| Anemic domain model | **Move Method / Encapsulate Field** | entities own invariants; fields `readonly`, changed only through methods |
| Deep nesting | **Replace Nested Conditional with Guard Clauses** | validate first, `throw` early, happy path last |
| Large class / god class | **Extract Class** | split dashboard assembly out of `ShelterService` into `DashboardService` |
| Boolean flag parameter | **Split Method / Introduce Parameter Object** | `dispatch(team, true)` -> `dispatch(team)` + `dispatchWithConfirmation(team)` or a command with named fields |
| Temporary / unclear names | **Rename Method / Rename Variable** | `data`, `tmp`, `handle` -> intention-revealing names |
| Dead code, unused imports | **Remove Dead Code** | delete, never comment out |
| Comment explaining what code does | **Extract Method** with a descriptive name, then delete the comment | |
| Dependency on concrete class | **Extract Interface + Dependency Injection** | service takes `ShelterRepository` interface, not the Prisma class |
| Mutating input objects | **Replace with immutable update** | return a new `Shelter` instead of changing the old one |

**Order of attack when auditing existing code:** (1) dead code and names, (2) guard clauses, (3) extract methods, (4) move methods to entities, (5) parameter objects and value objects, (6) polymorphism (State/Strategy), (7) extract classes. Run the 12.6 gates after each step group.

**How the State pattern works here (reference):**
```ts
interface TeamState {
  readonly name: RescueTeamStatus;
  dispatch(): TeamState;       // AVAILABLE -> EN_ROUTE
  arrive(): TeamState;         // EN_ROUTE  -> ON_SITE
  startReturn(): TeamState;    // ON_SITE   -> RETURNING
  completeReturn(): TeamState; // RETURNING -> AVAILABLE
}
// Each concrete state allows exactly ONE transition and throws InvalidTransitionError
// for the rest. RescueTeam holds a TeamState and only DELEGATES; it contains no
// `if (status === ...)`. Adding a state = adding a class; existing states stay untouched.
```

---

## 13. Folder layout (suggested file names; keep the layout)

```
src/modules/uc3-resources/
  CONTEXT.md
  index.ts                      createUc3Module(deps)
  domain/                       Shelter, RescueTeam + TeamState classes, SupplyStock, OccupancyEvent,
                                Distribution, TeamStatusEvent, DispatchRequest, value objects, errors
  services/                     ResourceAccessPolicy, ProcessedActionStore, IdempotentCommandExecutor,
                                ConflictQueue, ShelterService, DispatchService (+ rules/), DistributionService,
                                DashboardService, OccupancyEventQueryService, DistributionQueryService
  adapters/                     repository interfaces, in-memory impls, PartnerNotifier, DistrictAdjacency
    prisma/                     Prisma repositories, mappers, PrismaTransactionRunner (Prisma allowed ONLY here)
  client/                       browser-only offline queue + simulate-offline (excluded from coverage)
  seed/                         buildUc3Seed({ districtsByName, organizationsByName })
  __tests__/
```
`buildUc3Seed`: about 4 shelters (one nearly full), 4 teams (one per organisation type, one in an adjacent district), stock per organisation (Food, Water, Medicine, ShelterMaterial). It must not depend on fixed ids.

---

## 14. Definition of done (README section 10 + 19)

- [ ] Main flow, all alternates A1-A6, all exceptions E1-E5 work
- [ ] 4 UI screens match Group 18 wireframes + Group 20 changes; error, empty and loading states exist
- [ ] R01-R10 pass; coverage >= 85% measured and saved to `docs/test-results/uc3-coverage.txt`
- [ ] Role and district rules enforced in API routes and tested at the service policy
- [ ] Works with `DATA_STORE=memory` and `DATA_STORE=prisma` (or fallback is written in the report)
- [ ] All quality gates in 12.6 pass
- [ ] `docs/uml/seq-uc3-resources.puml` (alt/opt/loop fragments, `EN_ROUTE`, no `newpage`) and `docs/uml/class-resources.puml` exist
- [ ] `docs/code-quality-audit.md` written: principle/pattern -> file path -> why; smell -> how avoided; **refactoring log (smell, technique name from 12.7, file, before/after, commit)**; measured numbers (coverage, longest function, max complexity, clones, cycles)
- [ ] Every refactoring was done in a small step with tests green before and after, one commit each
- [ ] Real screenshots SA-1..SA-4 from the final commit (include at least one failure/alternate state)
- [ ] Prompts appended to `docs/ai-prompts.md` with a "what I checked or changed" note
- [ ] Peer review approved by Hasaranga

---

## 15. Known pitfalls and decisions to confirm

1. Contracts must be async (`Promise`); announce this to the group.
2. `uc3.prisma` needs `version` on `RescueTeam`/`SupplyStock` and a `DispatchRequest` model (section 4).
3. `DISPATCHED` (report) vs `EN_ROUTE` (code): align the report text.
4. R01 nuance: an over-capacity attempt does not make a non-full shelter FULL.
5. `ConflictQueueItem` has no `districtId` column: keep `districtId` inside `payload` and filter by it.
6. Adjacent districts have no model: use the `DistrictAdjacency` port with a static adapter.
7. Cross-organization rule is an assumption (section 6, rule 8): confirm with the group.
8. `Officer.districtId` is the district scope source for `Actor`.
9. If `src/shared/access` (Dissanayaka) is not merged yet, code against the expected `getActor` / `requireRole` signatures and report it. Do not create a competing implementation.
10. Next.js/Prisma docs in `node_modules` override anything remembered from training.

## 16. Out of scope

Login/logout/auth, Partner self-service interface, Deactivate Shelter, native mobile app, live GPS tracking, real SMS/push, PDF export (UC4), new npm dependencies, edits to other members' files.