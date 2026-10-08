# AI Prompts — UC4 Analysis Module

> Record of prompts used to build UC4 test coverage. Each prompt includes what was generated + what was manually verified/changed.

---

## Prompt 1: Project Setup & Context Discovery

**What was generated:** Initial project understanding — read `docs/uc4-context.md`, explored directory structure, identified key interfaces and test patterns.

**Manually verified:** Confirmed `InMemorySnapshotRepository`, `InMemoryShareLogRepository`, `FakeClock`, `SequentialIdGenerator`, `MockPartnerChannel`, `createUc4Module()` factory, and error classes exist.

---

## Prompt 2: Test Infrastructure Review

**What was generated:** Reviewed existing test files (`ReachCalculator.test.ts`, `AggregationService.test.ts`, `SnapshotService.test.ts`, `ShareService.test.ts`, `PdfExporter.test.ts`, `ReportFilterValidator.test.ts`) and fixtures (`fakeReaders.ts`, `fakeAttempts.ts`).

**Manually verified:** Confirmed test naming conventions (A01-A11 IDs in `it()` names), fake patterns, and coverage targets.

---

## Prompt 3: ReachCalculator Tests

**What was generated:** `src/modules/uc4-analysis/__tests__/ReachCalculator.test.ts` — 5 tests (A02.a-e) covering distinct citizen counting, per-channel stats, empty array, and G04 fix verification.

**Manually verified:** Tests pass with correct expected values from G04 fixture data.

---

## Prompt 4: AggregationService Tests

**What was generated:** `src/modules/uc4-analysis/__tests__/AggregationService.test.ts` — 4 tests (A03.a, A06.a, A08.a-b) covering shared filter guarantee, timeout behavior, and supply percentages.

**Manually verified:** Tests use `FakeAlertReader`, `SlowReader`, and `FakeDistributionReader` fakes.

---

## Prompt 5: SnapshotService Tests

**What was generated:** `src/modules/uc4-analysis/__tests__/SnapshotService.test.ts` — 6 tests (A03.c, A04.a-b, A05.a-b, A06.b) covering immutability, warning flags, and timeout-no-save behavior.

**Manually verified:** Tests use `FakeClock` with far-past date to trigger immediate timeout deterministically.

---

## Prompt 6: ShareLogRepository Interface

**What was generated:** Reviewed `ShareLogRepository.ts` interface — append-only design confirmed. No tests needed (interface-only file).

**Manually verified:** Interface has `save()` and `listByReport()` only — no update/delete.

---

## Prompt 7: PdfExporter Tests

**What was generated:** `src/modules/uc4-analysis/__tests__/PdfExporter.test.ts` — 5 tests (A11.a-e) covering PDF generation, section filtering, empty snapshots, null percentages, and Sinhala labels.

**Manually verified:** Added tests A11.f (Tamil), A11.g (section filtering), A11.h (warning flag), A11.i (error wrapping) — 9 tests total.

---

## Prompt 8: ShareService Tests

**What was generated:** `src/modules/uc4-analysis/__tests__/ShareService.test.ts` — 5 tests (A07.a-e) covering multi-org sharing, retry semantics, validation, not-found, and all-failures.

**Manually verified:** Added tests A07.f (unknown org), A07.g (alternating sequence) — 7 tests total.

---

## Prompt 9: Prisma Adapters Smoke Test

**What was generated:** Reviewed Prisma adapter files — no tests written (adapters excluded from coverage per vitest config).

**Manually verified:** `adapters/prisma/` excluded from coverage in `vitest.config.ts`.

---

## Prompt 10: Factory + Container

**What was generated:** Reviewed `createUc4Module()` factory in `src/modules/uc4-analysis/index.ts`. No tests needed — factory is covered via integration tests.

**Manually verified:** Factory correctly wires all 5 readers, services, and repositories.

---

## Prompt 11: API Routes

**What was generated:** Reviewed API routes (`route.ts`, `[id]/route.ts`, `[id]/pdf/route.ts`, `[id]/share/route.ts`). Coverage excluded via vitest config (`src/app/**`).

**Manually verified:** Routes use `getActor()` + `requireRole()` from `src/shared/access`.

---

## Prompt 12: Integration Tests

**What was generated:**
- `tests/integration/uc134-to-uc4.test.ts` — 2 tests (INT-01, INT-02)
- `tests/integration/roles.test.ts` — 3 tests (ROLE-01, ROLE-02, ROLE-03)

**Manually verified/changed:**
- Fixed seed data: initial 1000 citizens × 2 channels had only 900 distinct reached. Corrected to make all 1000 citizens reached via PUSH (SMS failed for last 100).
- Removed broken INT-02 placeholder test that threw `Error('Refactoring needed')`.
- Verified `ScriptedRng` produces deterministic outcomes with `MockPartnerChannel`.

---

## Prompt 13: Coverage Evidence

**What was generated:**
- `docs/test-results/uc4-coverage.txt` — coverage report scoped to UC4
- `docs/test-results/all-tests.txt` — verbose test output
- `src/modules/uc4-analysis/__tests__/errors.test.ts` — 6 new tests for error classes
- `docs/ai-prompts.md` — this file

**Manually verified/changed:**
- Added `errors.test.ts` to raise `errors.ts` coverage from 66.66% to 100%.
- Added ReachCalculator tests A02.f-g for QUEUED/SENT status branches.
- Added ShareService test A07.f for unknown organization branch, A07.g for alternating sequence.
- Added ReportFilterValidator test for array-index field collection.
- Added PdfExporter tests A11.f-i for Tamil, section filtering, warning flag, error wrapping.

---

## Coverage Summary (Final)

| Metric    | Before | After |
|-----------|--------|-------|
| Stmts     | 92.21% | 95.33% |
| Branch    | 84.78% | 88.04% |
| Funcs     | 93.02% | 97.67% |
| Lines     | 92.15% | 95.29% |

All metrics ≥ 80%. ✅

---

## Test Count Summary

| Category | Count |
|----------|-------|
| ReachCalculator | 7 (A02.a-g) |
| AggregationService | 4 (A03.a, A06.a, A08.a-b) |
| SnapshotService | 6 (A03.c, A04.a-b, A05.a-b, A06.b) |
| ShareService | 7 (A07.a-g) |
| ReportFilterValidator | 9 |
| PdfExporter | 9 (A11.a-i) |
| errors | 6 |
| Integration (uc134-to-uc4) | 2 (INT-01, INT-02) |
| Integration (roles) | 3 (ROLE-01-03) |
| **Total UC4** | **53** |
