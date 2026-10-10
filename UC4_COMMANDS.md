# UC4 (Analysis & Reporting) Terminal Testing Guide

This guide provides all terminal commands to run **ONLY UC4 checks** (Use Case 4: Analysis & Reporting System).

---

## 🚀 Quick Reference Commands

| Test Suite | Purpose | Command |
| :--- | :--- | :--- |
| **UC4 Unit Tests** *(Fastest)* | Runs all 49 in-memory unit tests | `npx vitest run src/modules/uc4-analysis` |
| **UC4 DB Integration Tests** | Runs 50+ database checks with Prisma & PostgreSQL | `npm run test:uc4:db` |
| **UC4 Standalone DB Script** | Runs DB integration test via `tsx` runner | `npm run test:uc4:db:script` |
| **UC4 Cross-Module Tests** | Runs UC1-UC3 to UC4 integration tests | `npx vitest run tests/integration/uc134-to-uc4.test.ts` |
| **ALL UC4 Tests** *(Complete)* | Runs Unit + DB Integration + Cross-module tests | `npx vitest run src/modules/uc4-analysis tests/integration/uc4-db-full.test.ts tests/integration/uc134-to-uc4.test.ts` |
| **UC4 Coverage Report** | Generates test coverage report for UC4 | `npm run test:uc4` |

---

## 📋 Detailed Command Instructions

### 1. Run UC4 Unit Tests (In-Memory, No DB Required)
Executes all unit tests for UC4 services (`AggregationService`, `PdfExporter`, `ReachCalculator`, `ReportFilterValidator`, `ShareService`, `SnapshotService`, and error handling) in isolated memory.

```bash
# Option A: Direct Vitest runner (Recommended - Fast < 1s)
npx vitest run src/modules/uc4-analysis

# Option B: Run in Watch mode (Auto re-runs on code changes)
npx vitest src/modules/uc4-analysis
```

---

### 2. Run UC4 Full Database Integration Tests
Executes the comprehensive database verification suite (Sections A through J) testing live database interactions, aggregations, queries, role guards, PDF rendering from DB data, and raw SQL queries.

```bash
# Option A: via npm script
npm run test:uc4:db

# Option B: via Vitest directly
npx vitest run tests/integration/uc4-db-full.test.ts
```

---

### 3. Run UC4 Standalone Database Script (`tsx`)
Executes the UC4 database integration checks directly using `tsx` without Vitest wrappers, outputting a formatted section-by-section breakdown.

```bash
# Option A: via npm script
npm run test:uc4:db:script

# Option B: via tsx directly
npx tsx scripts/uc4-full-db-test.ts
```

---

### 4. Run UC4 Cross-Module Integration Tests
Tests data pipeline flow from UC1 (Alerts), UC2 (Reports), and UC3 (Resources) into UC4 (Analysis & Reporting).

```bash
npx vitest run tests/integration/uc134-to-uc4.test.ts
```

---

### 5. Run EVERY UC4 Test in a Single Command
To run all unit tests, DB integration tests, and cross-module tests strictly for UC4 in one terminal invocation:

```bash
npx vitest run src/modules/uc4-analysis tests/integration/uc4-db-full.test.ts tests/integration/uc134-to-uc4.test.ts
```

---

### 6. Run UC4 Code Coverage Report
Generates a code coverage report limited strictly to the UC4 Analysis codebase (`src/modules/uc4-analysis/**`).

```bash
npm run test:uc4
```

---

## 📁 UC4 Test Directory Structure

- `src/modules/uc4-analysis/__tests__/`: Unit test files for UC4 domain services and handlers.
- `tests/integration/uc4-db-full.test.ts`: DB integration test file covering database checks A through J.
- `tests/integration/uc4-db-checks.ts`: Assertion definitions and section specs for DB integration.
- `tests/integration/uc4-db-fixtures.ts`: Seeding and cleanup utilities for UC4 DB tests.
- `scripts/uc4-full-db-test.ts`: Standalone execution script for DB integration checks.
- `tests/integration/uc134-to-uc4.test.ts`: Cross-module integration tests.
