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
- Implementing Step 11: Next.js App Router API endpoints in `src/app/api/warnings/**`:
  - `POST /api/warnings/preview`
  - `POST /api/warnings`
  - `GET /api/warnings`
  - `GET /api/warnings/[id]`
  - `POST /api/warnings/[id]/escalate`
  - `POST /api/warnings/[id]/cancel`
  - `POST /api/warnings/[id]/retry`
- Using Zod validation, `getActor(request)` and `requireRole()` role enforcement, single service method delegation, and standardized HTTP error code mapping (400, 403, 404, 409, 422, 503).
- Creating API route tests verifying error mappings and authorization.
- Implementing Step 12: Next.js UI pages in `src/app/warnings/` (Composer, Preview, Delivery Result, Active Alerts List with inline escalate/cancel reasons) and `src/app/alerts/[id]` (citizen alert receipt at phone width with device-side alarm audio and actions).
