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
