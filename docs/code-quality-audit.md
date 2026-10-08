# UC3 Code Quality Audit & Refactoring Log (Graded: 20 Marks)

**Author:** SANDARUWAN H M K (IT23633322)  
**Module:** UC3 - Coordinate Emergency Resources  
**Repository:** DEWECS - Smart Disaster Early-Warning and Emergency Coordination System

---

## 1. Measured Quality Metrics & Gate Audit

| Metric | Target / Limit | Measured Value | Compliance Status |
|---|---|---|---|
| **Statement / Line Coverage** | &ge; 85% | **86.25%** | **PASS** |
| **Max Cyclomatic Complexity** | &le; 8 | **4** | **PASS** |
| **Max Function Line Length** | &le; 25 lines | **22 lines** | **PASS** |
| **Max Method Parameters** | &le; 3 (Command objects) | **3** | **PASS** |
| **Code Duplication (jscpd)** | 0 clones (&ge; 6 lines) | **0 clones** | **PASS** |
| **Circular Dependencies (madge)** | 0 circular cycles | **0 cycles** | **PASS** |
| **Forbidden Imports/Calls (grep)** | 0 (`Date.now`, `new Date` in domain/service) | **0 violations** | **PASS** |

---

## 2. SOLID Principles & Design Pattern Traceability

| Principle / Pattern | Source File Path | Architectural Justification & Role |
|---|---|---|
| **Single Responsibility (S)** | [`ShelterService.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/services/ShelterService.ts) | Responsible solely for shelter occupancy updates and registration. Never touches stock or teams. |
| **Open / Closed (O)** | [`DispatchRule.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/services/rules/DispatchRule.ts) | New dispatch confirmation rules (e.g. curfew or hazard level) are added as new Strategy classes without modifying existing rules. |
| **Liskov Substitution (L)** | [`InMemoryShelterRepository.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/adapters/memory/InMemoryShelterRepository.ts) &amp; [`PrismaShelterRepository.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/adapters/prisma/PrismaShelterRepository.ts) | Both implementations are 100% interchangeable behind `ShelterRepository` interface. |
| **Interface Segregation (I)** | [`OccupancyEventReader.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/shared/contracts/OccupancyEventReader.ts) | UC4 analysis engine receives a narrow read-only interface; write operations are segregated. |
| **Dependency Inversion (D)** | [`DistributionService.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/services/DistributionService.ts) | High-level service depends only on abstract repository interfaces and injected `Clock`/`IdGenerator`/`TransactionRunner`. |
| **State Pattern** | [`TeamState.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/domain/states/TeamState.ts) | Replaces status `if/else` chains with polymorphic `AvailableState`, `EnRouteState`, `OnSiteState`, `ReturningState` classes. |
| **Repository Pattern** | [`ShelterRepository.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/adapters/repositories/ShelterRepository.ts) | Hides storage persistence details (in-memory or Prisma DB) from domain logic. |
| **Unit of Work Pattern** | [`TransactionRunner.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/shared/infra/TransactionRunner.ts) | Ensures multi-repository supply distribution and stock decrement commit atomically or roll back together. |
| **Strategy Pattern** | [`DispatchRule.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/services/rules/DispatchRule.ts) | Encapsulates cross-organization and cross-district confirmation validation algorithms into Strategy classes. |
| **Composition Pipeline** | [`IdempotentCommandExecutor.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/services/IdempotentCommandExecutor.ts) | Single point of composition for role checking, idempotency replay, and action recording. |
| **Factory Pattern** | [`index.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/index.ts) | `createUc3Module(deps)` provides single point of dependency injection and wiring. |
| **Adapter / Port Pattern** | [`PartnerNotifier.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/adapters/ports/PartnerNotifier.ts) | Decouples external partner notifications from core domain services. |
| **Command / Parameter Object** | [`DispatchTeamCommand`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/services/DispatchService.ts) | Encapsulates parameter lists into typed command objects, keeping parameter count &le; 3. |
| **Value Object Pattern** | [`OccupancyCount.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/domain/valueObjects/OccupancyCount.ts) &amp; [`Quantity.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/domain/valueObjects/Quantity.ts) | Encapsulates validation of non-negative and positive integers, eliminating primitive obsession. |

---

## 3. Code Smells Hunted & Avoided

| Code Smell | How Avoided | Source File |
|---|---|---|
| **God Class** | Split domain services into decoupled classes (`ShelterService`, `DispatchService`, `DistributionService`, `DashboardService`). | `services/` |
| **Primitive Obsession** | Wrapped numeric quantity inputs into self-validating `Quantity` and `OccupancyCount` value objects. | `domain/valueObjects/` |
| **Switch / If-Chain on Status** | Implemented State Pattern (`TeamState`) for legal rescue team state transitions. | `domain/states/TeamState.ts` |
| **Magic Numbers & Strings** | Extracted status literal unions and error message constants. | `domain/entities/` |
| **Feature Envy** | Moved occupancy bound checking inside `Shelter.withOccupancy()` entity method. | `domain/entities/Shelter.ts` |
| **Anemic Domain Model** | Entities (`Shelter`, `RescueTeam`, `SupplyStock`) manage their own invariants and return immutable updated copies. | `domain/entities/` |
| **Duplicated Code** | Extracted idempotency execution pipeline into `IdempotentCommandExecutor`. | `services/IdempotentCommandExecutor.ts` |
| **Catch-and-Ignore** | All errors map to typed `DomainError` subclasses with explicit HTTP status codes. | `shared/infra/errors.ts` |

---

## 4. Refactoring Technique Log

| # | Smell | Refactoring Technique | Target File | Before | After | Commit |
|---|---|---|---|---|---|---|
| 1 | Long method in `updateOccupancy` | **Extract Method** | `ShelterService.ts` | Single 45-line method | Extracted `executeCommand` pipeline and `withOccupancy` entity check | `uc3: refactor - extract occupancy validation to entity` |
| 2 | Status if/else switch chains | **Replace Conditional with Polymorphism** | `RescueTeam.ts` | String switch on `status` | State Pattern `TeamState` concrete classes | `uc3: refactor - introduce TeamState pattern` |
| 3 | Primitive raw numbers | **Replace Primitive with Object** | `DistributionService.ts` | Raw `number` quantity | `Quantity` value object | `uc3: refactor - add Quantity value object` |
| 4 | Duplicated idempotency check | **Extract Class** | `IdempotentCommandExecutor.ts` | Repeated replay logic in 3 services | Single `IdempotentCommandExecutor` pipeline | `uc3: refactor - extract IdempotentCommandExecutor` |
| 5 | Long parameter lists | **Introduce Parameter Object** | `DispatchService.ts` | 6 positional parameters | `DispatchTeamCommand` parameter object | `uc3: refactor - introduce parameter objects` |
