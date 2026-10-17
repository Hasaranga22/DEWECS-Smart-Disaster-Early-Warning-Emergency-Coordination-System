# UC3 (Emergency Resources) Terminal Testing Guide

This guide provides all terminal commands to run **ONLY UC3 checks** (Use Case 3: Emergency Resources Coordination).

---

## 🚀 Quick Reference Commands

| Test Suite | Purpose | Tests | Command |
| :--- | :--- | :--- | :--- |
| **All UC3 Unit Tests** *(Fast)* | Runs all 10 unit test files in memory | 67 tests | `npx vitest run src/modules/uc3-resources` |
| **UC3 Coverage Report** *(Viva)* | Generates >98% line coverage report | 67 tests | `npm run test:uc3` |
| **UC3 Integration Tests** | Full resources lifecycle + cross-module tests | 13 tests | `npm run test:uc3:integration` |
| **ALL UC3 Tests Combined** | Complete run (Unit + Integration suites) | 80 tests | `npx vitest run src/modules/uc3-resources tests/integration/uc3-resources-full.test.ts tests/integration/uc3-cross-module.test.ts` |
| **TypeScript Type Check** | Verifies 0 type/compilation errors | Type check | `npx tsc --noEmit` |

---

## 📋 Run All Tests Together

### 1. Run all UC3 Unit Tests (Fast execution)
```powershell
npx vitest run src/modules/uc3-resources
```

### 2. Run all UC3 Unit Tests with Coverage Report (>80% Viva Requirement)
```powershell
npm run test:uc3
```

### 3. Run all UC3 Integration Tests
```powershell
npm run test:uc3:integration
```

### 4. Run Complete UC3 Suite (Unit + Integration)
```powershell
npx vitest run src/modules/uc3-resources tests/integration/uc3-resources-full.test.ts tests/integration/uc3-cross-module.test.ts
```

---

## 🔬 Run Individual Test Files Separately

Execute each command directly in PowerShell from the project root directory.

### Application Services Tests

#### 1. Shelter Service (`ShelterService.test.ts`)
Tests shelter registration, occupancy updates, capacity limits, alternative shelter discovery, version conflict detection, and automated conflict queueing.
```powershell
npx vitest run src/modules/uc3-resources/__tests__/ShelterService.test.ts
```

#### 2. Dispatch Service (`DispatchService.test.ts`)
Tests rescue team dispatch, state progression (`AVAILABLE` → `EN_ROUTE` → `ON_SITE` → `RETURNING` → `AVAILABLE`), event logging, partner notifications, backup team discovery in adjacent districts, and unassigned dispatch requests.
```powershell
npx vitest run src/modules/uc3-resources/__tests__/DispatchService.test.ts
```

#### 3. Distribution Service (`DistributionService.test.ts`)
Tests atomic relief supply distribution to shelters, stock-on-hand decrement, `InsufficientStockError`, invalid quantities, and rollback on failure.
```powershell
npx vitest run src/modules/uc3-resources/__tests__/DistributionService.test.ts
```

#### 4. Dashboard Service (`DashboardService.test.ts`)
Tests district resource aggregation (capacity, occupancy, available rescue teams, open conflicts), active UC1 warning preselection, and role-based access filtering (DMC official vs District officer).
```powershell
npx vitest run src/modules/uc3-resources/__tests__/DashboardService.test.ts
```

---

### Domain Entities & State Machine Tests

#### 5. Rescue Team Entity (`RescueTeam.test.ts`)
Tests rescue team state machine transitions, dispatch eligibility, `TeamNotAvailableError`, `InvalidTransitionError`, and coordinate updates.
```powershell
npx vitest run src/modules/uc3-resources/__tests__/RescueTeam.test.ts
```

#### 6. Shelter Entity (`Shelter.test.ts`)
Tests shelter creation, occupancy changes, automatic status updates (`OPEN` vs `FULL`), rejection of negative capacities, and immutability.
```powershell
npx vitest run src/modules/uc3-resources/__tests__/Shelter.test.ts
```

---

### Security, Offline & Concurrency Tests

#### 7. Conflict Queue (`ConflictQueue.test.ts`)
Tests enqueuing version conflicts from offline synchronization, district-specific filtering, and resolution (`RETRY` / `DISCARD`).
```powershell
npx vitest run src/modules/uc3-resources/__tests__/ConflictQueue.test.ts
```

#### 8. Resource Access Policy (`ResourceAccessPolicy.test.ts`)
Tests Role-Based Access Control (RBAC): allowing `DMC_OFFICIAL` across all districts, restricting `DISTRICT_OFFICER` to their assigned district, and rejecting unauthorized roles (`CITIZEN`).
```powershell
npx vitest run src/modules/uc3-resources/__tests__/ResourceAccessPolicy.test.ts
```

#### 9. Offline Action Queue (`OfflineActionQueue.test.ts`)
Tests client-side IndexedDB queue for offline action storage and synchronization.
```powershell
npx vitest run src/modules/uc3-resources/client/__tests__/OfflineActionQueue.test.ts
```

#### 10. UC3 Core Orchestrator (`uc3Core.test.ts`)
Tests full container wiring, end-to-end module coordination, and idempotency key handling across all UC3 resources.
```powershell
npx vitest run src/modules/uc3-resources/__tests__/uc3Core.test.ts
```

---

### Integration Tests

#### 11. End-to-End UC3 Lifecycle (`uc3-resources-full.test.ts`)
Tests complete multi-resource coordination: shelter registration + team dispatch + supply distribution in a unified workflow.
```powershell
npx vitest run tests/integration/uc3-resources-full.test.ts
```

#### 12. Cross-Module Integration (`uc3-cross-module.test.ts`)
Tests integration between UC1 (Warnings), UC2 (Field Reports), and UC3 (Resource Allocation).
```powershell
npx vitest run tests/integration/uc3-cross-module.test.ts
```

---

## 🎯 Viva Step-by-Step Demonstration Guide

When the examiner asks you to demonstrate your tests:

### Step 1: Open PowerShell in the project root
Make sure you are in:
```
E:\DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System
```

### Step 2: Run the Coverage Command
```powershell
npm run test:uc3
```
**What to point out:**
- Point out that **all 10 test files (67 tests)** pass with **0 failures**.
- Point to the coverage table showing **>98% Line Coverage** and **>95% Function Coverage** (far exceeding the 80% marks requirement).

### Step 3: Run the Integration Tests
```powershell
npm run test:uc3:integration
```
**What to point out:**
- Point out that all **13 integration tests** pass across 2 test suites.
- Explain that `uc3-cross-module.test.ts` validates that UC3 correctly receives warning levels from UC1 and damage assessments from UC2.

### Step 4: If asked to demonstrate an individual component
Pick the corresponding command from the table above (e.g., `ShelterService.test.ts` or `DispatchService.test.ts`) and run it individually:
```powershell
npx vitest run src/modules/uc3-resources/__tests__/DispatchService.test.ts
```

---

## 📁 UC3 Test Directory Structure

```
DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/
├── src/modules/uc3-resources/
│   ├── __tests__/
│   │   ├── ConflictQueue.test.ts          # Offline conflict queue & resolution
│   │   ├── DashboardService.test.ts       # Aggregation & alert preselection
│   │   ├── DispatchService.test.ts        # Rescue team dispatch & state flow
│   │   ├── DistributionService.test.ts    # Supply distribution & stock decrement
│   │   ├── RescueTeam.test.ts             # Team domain entity & transitions
│   │   ├── ResourceAccessPolicy.test.ts   # Role-based access control (RBAC)
│   │   ├── Shelter.test.ts                # Shelter domain entity & status calculation
│   │   ├── ShelterService.test.ts         # Shelter capacity & occupancy updates
│   │   └── uc3Core.test.ts                # Module container & full workflow
│   └── client/__tests__/
│       └── OfflineActionQueue.test.ts     # Client offline queue (IndexedDB)
└── tests/integration/
    ├── uc3-resources-full.test.ts         # End-to-end UC3 resource management
    └── uc3-cross-module.test.ts           # Cross-module integration with UC1 & UC2
```
