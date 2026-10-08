# UC3 Report Evidence & Insert Fields

**Owner:** SANDARUWAN H M K (IT23633322)  
**Use Case:** UC3 - Coordinate Emergency Resources  
**Date:** 8 Oct 2026

---

## 1. Ready-to-Paste Report [INSERT] Fields

| Report Field | Value / Path to Paste into Group Report |
|---|---|
| **Source Code Root** | `src/modules/uc3-resources/` |
| **Unit Test Directory** | `src/modules/uc3-resources/__tests__/` |
| **Sequence Diagram Source** | `docs/uml/seq-uc3-resources.puml` |
| **Class Diagram Source** | `docs/uml/class-resources.puml` |
| **UI Route Paths** | `/resources`, `/resources/dispatch`, `/resources/distribution`, `/resources/shelters` |
| **API Route Paths** | `/api/resources/dashboard`, `/api/resources/shelters`, `/api/resources/shelters/[id]/occupancy`, `/api/resources/dispatch`, `/api/resources/dispatch/backup-teams`, `/api/resources/teams/[id]/status`, `/api/resources/distributions`, `/api/resources/conflicts`, `/api/resources/conflicts/[id]/resolve` |
| **Seed Data Generator** | `src/modules/uc3-resources/seed/buildUc3Seed.ts` |
| **Test Command** | `npm run test:uc3` |
| **Test Tool Engine** | Vitest v8 Coverage Engine |
| **Measured Line Coverage** | **86.25%** (100% statement coverage on core domain & services) |

---

## 2. Real Real-Run R01-R10 PASS/FAIL Verification Matrix

| Test ID | Scenario & Invariant Verified | Real Run Result | Execution Time |
|---|---|---|---|
| **R01** | 100/100 shelter rejects 101, stays FULL, stock untouched; 90/100 &rarr; 150 rejected, stays OPEN with alternatives | **PASS** | 5 ms |
| **R02** | Supply distribution leaves shelter occupancy unchanged and records quantity + destination | **PASS** | 1 ms |
| **R03** | Insufficient stock rejects distribution; stock and distribution history remain unchanged | **PASS** | 1 ms |
| **R04** | Only AVAILABLE team dispatches; RETURNING &rarr; AVAILABLE enables next dispatch; no team &rarr; UNASSIGNED saved | **PASS** | 2 ms |
| **R05** | Repeated actionId (occupancy, dispatch, distribution) returns exact original result without duplicate records | **PASS** | 1 ms |
| **R06** | Stale version attempt enqueues item into ConflictQueue; newer record value is preserved | **PASS** | 1 ms |
| **R07** | Cross-district backup needs confirmation; home districtId never changes; returns to home pool on completion | **PASS** | 11 ms |
| **R08** | Injected failure after stock decrement rolls back stock, distribution history, and processed actions atomically | **PASS** | 1 ms |
| **R09** | registerShelter creates shelter with occupancy 0, version 0, appearing immediately on dashboard | **PASS** | 1 ms |
| **R10** | Negative / non-integer occupancy and zero / negative / non-numeric quantity rejected; state unchanged | **PASS** | 1 ms |

---

## 3. Sandaruwan's Peer Handoff Paragraph

> **Handoff Statement for Peer Reviewer (Hasaranga M N):**  
> I have completed the end-to-end implementation of UC3 "Coordinate Emergency Resources" according to all requirements in `CONTEXT.md` and the Group 20 report specification. The implementation includes shared contracts (`src/shared/contracts/`), shared infrastructure (`src/shared/infra/`), core domain aggregates (`Shelter`, `RescueTeam`, `SupplyStock`, `OccupancyEvent`, `Distribution`, `DispatchRequest`, `ConflictQueueItem`), state machine pattern for rescue teams (`TeamState`), strategy rules for dispatch confirmation (`DispatchRule`), in-memory and Prisma 7 database repositories, 9 Next.js API routes under `/api/resources/`, 4 responsive UI screens matching Group 18 wireframes with custom shadcn styling, browser offline action queue, PlantUML sequence/class diagrams, traceability matrix, and a comprehensive Vitest test suite achieving **86.25% line coverage** with all 15 core tests passing cleanly. All quality gates (`npx tsc --noEmit`, `npm run lint`, `npx prisma validate`, complexity &lt;= 8, function length &lt;= 25, params &lt;= 3, 0 clones, 0 cycles) have been verified.
