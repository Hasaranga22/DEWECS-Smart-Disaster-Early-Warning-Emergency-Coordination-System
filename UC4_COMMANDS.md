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

Unit tests — src/modules/uc4-analysis/__tests__/ (12 files):

npx vitest run src/modules/uc4-analysis/__tests__/districtAliases.test.ts
npx vitest run src/modules/uc4-analysis/__tests__/dataBridges.test.ts
npx vitest run src/modules/uc4-analysis/__tests__/hydrate.test.ts
npx vitest run src/modules/uc4-analysis/__tests__/AggregationService.test.ts
npx vitest run src/modules/uc4-analysis/__tests__/SnapshotService.test.ts
npx vitest run src/modules/uc4-analysis/__tests__/ShareService.test.ts
npx vitest run src/modules/uc4-analysis/__tests__/ReportFilterValidator.test.ts
npx vitest run src/modules/uc4-analysis/__tests__/ReachCalculator.test.ts
npx vitest run src/modules/uc4-analysis/__tests__/PrismaSnapshotRepository.test.ts
npx vitest run src/modules/uc4-analysis/__tests__/PrismaShareLogRepository.test.ts
npx vitest run src/modules/uc4-analysis/__tests__/PdfExporter.test.ts
npx vitest run src/modules/uc4-analysis/__tests__/errors.test.ts
All as one folder: npx vitest run src/modules/uc4-analysis → 12 files / 78 tests green.

Integration tests — tests/integration/ (6 files):

npx vitest run tests/integration/uc134-to-uc4.test.ts
npx vitest run tests/integration/roles.test.ts
npx vitest run tests/integration/uc4-memory-wiring.test.ts
npx vitest run tests/integration/uc4-demo-scenario.test.ts
npx vitest run tests/integration/uc4-partner-orgs.test.ts
npx vitest run tests/integration/uc4-db-full.test.ts

All as one folder: npx vitest run tests/integration

Full gates (the exact acceptance commands):

npx vitest run src/modules/uc4-analysis tests/integration/uc134-to-uc4.test.ts tests/integration/roles.test.ts
npm run test:uc4
npx tsc --noEmit
npx tsx scripts/uc4-seed-sample-data.ts
npx tsx scripts/uc4-verify-demo.ts
Notes: run from repo root (...\DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System); uc4-db-full.test.ts has 2 known pre-existing failures (H.1/H.3, teammate-owned) and its teardown wipes seeded Kegalle demo data — always re-run seed+verify after it.

## 📁 UC4 Test Directory Structure

- `src/modules/uc4-analysis/__tests__/`: Unit test files for UC4 domain services and handlers.
- `tests/integration/uc4-db-full.test.ts`: DB integration test file covering database checks A through J.
- `tests/integration/uc4-db-checks.ts`: Assertion definitions and section specs for DB integration.
- `tests/integration/uc4-db-fixtures.ts`: Seeding and cleanup utilities for UC4 DB tests.
- `scripts/uc4-full-db-test.ts`: Standalone execution script for DB integration checks.
- `tests/integration/uc134-to-uc4.test.ts`: Cross-module integration tests.

http://localhost:3000/resources