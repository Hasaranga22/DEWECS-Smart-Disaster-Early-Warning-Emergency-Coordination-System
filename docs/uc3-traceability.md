# UC3 Traceability Matrix

**Owner:** SANDARUWAN H M K (IT23633322)  
**Use Case:** UC3 - Coordinate Emergency Resources

---

## 1. Use Case Scenario Requirements Traceability

| Scenario Item | Description | Primary Source File | Vitest Test ID | UI Screen / API Route |
|---|---|---|---|---|
| **Main 1** | Open district resource dashboard with last refresh time | [`DashboardService.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/services/DashboardService.ts) | `R09`, `uc3Core.test.ts` | `/resources`, `GET /api/resources/dashboard` |
| **Main 2** | Review shelter capacity, occupancy, team state & stock | [`DashboardService.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/services/DashboardService.ts) | `R09`, `uc3Core.test.ts` | `/resources`, `GET /api/resources/dashboard` |
| **Main 3** | Explicitly update shelter occupancy (absolute number) | [`ShelterService.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/services/ShelterService.ts) | `R01`, `R05`, `R09` | `/resources/shelters`, `POST /api/resources/shelters/[id]/occupancy` |
| **Main 4** | Select AVAILABLE team, confirm dispatch & record incident | [`DispatchService.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/services/DispatchService.ts) | `R04`, `R07` | `/resources/dispatch`, `POST /api/resources/dispatch` |
| **Main 5** | Record team state advance: RETURNING &rarr; AVAILABLE | [`DispatchService.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/services/DispatchService.ts) | `R04`, `R07` | `/resources/dispatch`, `POST /api/resources/teams/[id]/status` |
| **Main 6** | Distribute stock to shelter & update stock atomically | [`DistributionService.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/services/DistributionService.ts) | `R02`, `R03`, `R08` | `/resources/distribution`, `POST /api/resources/distributions` |
| **Main 7** | Refresh dashboard to audit timestamps & actors | [`DashboardService.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/services/DashboardService.ts) | `R09` | `/resources`, `GET /api/resources/dashboard` |
| **A1** | Preselected district from escalated UC1 warning | [`DashboardService.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/services/DashboardService.ts) | `uc3Core.test.ts:Reader` | `/resources` (A1 Notice Banner) |
| **A2** | Team returns RETURNING &rarr; AVAILABLE pool | [`DispatchService.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/services/DispatchService.ts) | `R04` | `/resources/dispatch` |
| **A3** | Cross-organization team confirmation rule | [`DispatchRule.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/services/rules/DispatchRule.ts) | `uc3Core.test.ts:CrossOrg` | `/resources/dispatch` (Combined Alert Dialog) |
| **A4** | Offline queued actions with seen version | [`OfflineActionQueue.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/client/OfflineActionQueue.ts) | `OfflineActionQueue.test.ts` | Client Offline Queue & Switch Toggle |
| **A5** | Cross-district backup team dispatch | [`DispatchService.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/services/DispatchService.ts) | `R07` | `/resources/dispatch`, `GET /api/resources/dispatch/backup-teams` |
| **A6** | Activate new shelter with occupancy 0, version 0 | [`ShelterService.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/services/ShelterService.ts) | `R09` | `/resources` (Activate Shelter Modal), `POST /api/resources/shelters` |
| **E1** | Full shelter error & alternative suggestions | [`Shelter.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/domain/entities/Shelter.ts) | `R01` | `/resources/shelters` (OverCapacity Modal Banner) |
| **E2** | No team available anywhere &rarr; UNASSIGNED saved | [`DispatchService.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/services/DispatchService.ts) | `R04` | `/resources/dispatch` |
| **E3** | Stock shortfall shortfall rollback | [`DistributionService.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/services/DistributionService.ts) | `R03`, `R08` | `/resources/distribution` |
| **E4** | Version conflict queued for officer review | [`ConflictQueue.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/services/ConflictQueue.ts) | `R06`, `uc3Core.test.ts:Conflict` | `/resources/shelters` (Conflict Queue List), `GET /api/resources/conflicts` |
| **E5** | Negative / non-integer input rejection | [`OccupancyCount.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/domain/valueObjects/OccupancyCount.ts) | `R10` | Inline form validation on `/resources/shelters` & `/resources/distribution` |

---

## 2. Business Rules & Critique Findings Traceability

| Rule / Finding | Description | Primary Source File | Vitest Test ID | UI Screen / Route |
|---|---|---|---|---|
| **Rule 1** | Only DISTRICT_OFFICER in assigned district | [`ResourceAccessPolicy.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/services/ResourceAccessPolicy.ts) | `uc3Core.test.ts:Roles` | All `/api/resources/*` routes |
| **Rule 2** | Dispatch only from AVAILABLE; RETURNING &rarr; AVAILABLE | [`RescueTeam.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/domain/entities/RescueTeam.ts) | `R04` | `/resources/dispatch` |
| **Rule 3** | Non-negative stock & occupancy; capacity bounds | [`Shelter.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/domain/entities/Shelter.ts) | `R01`, `R10` | `/resources/shelters` |
| **Rule 4** | Distribution & occupancy independent commands | [`DistributionService.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/services/DistributionService.ts) | `R02` | `/resources/distribution` & `/resources/shelters` |
| **Rule 5** | Distribution commits atomically | [`DistributionService.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/services/DistributionService.ts) | `R08` | `POST /api/resources/distributions` |
| **Rule 6** | Unique `actionId` idempotency & versioning | [`IdempotentCommandExecutor.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/services/IdempotentCommandExecutor.ts) | `R05`, `R06` | All state-changing API routes |
| **Rule 7** | Cross-district dispatch confirmation; home ID unchanged | [`DispatchService.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/services/DispatchService.ts) | `R07` | `/resources/dispatch` |
| **Rule 8** | Cross-organization confirmation rule | [`DispatchRule.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/services/rules/DispatchRule.ts) | `uc3Core.test.ts:CrossOrg` | `/resources/dispatch` |
| **Rule 9** | Partner self-service out of scope | [`buildUc3Seed.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/seed/buildUc3Seed.ts) | `uc3Core.test.ts:Seed` | Pre-registered seed data only |
| **Rule 10** | System-set team status; no manual checkboxes | [`DispatchService.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/services/DispatchService.ts) | `R04` | `/resources/dispatch` |
| **G05 / G06** | Dated historical records for occupancy & distributions | [`OccupancyEventQueryService.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/services/OccupancyEventQueryService.ts) | `uc3Core.test.ts:Reader` | Readers for UC4 analysis |
| **G07** | Stale version queued, never overwritten | [`ConflictQueue.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/services/ConflictQueue.ts) | `R06` | `/resources/shelters` (Conflict Queue) |
| **G08** | Status shown as text, inline validation, accessibility | [`page.tsx`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/app/resources/page.tsx) | `UI Render` | All `/resources/*` screens |
| **G09** | All-or-nothing stock & distribution transaction | [`DistributionService.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/services/DistributionService.ts) | `R08` | `POST /api/resources/distributions` |
| **G10** | Adjacent district fallback (Colombo, Gampaha, Kegalle) | [`DistrictAdjacency.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/adapters/ports/DistrictAdjacency.ts) | `R07` | `/resources/dispatch` |
| **G11 / G12** | Read-only system status badges | [`DispatchService.ts`](file:///e:/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/src/modules/uc3-resources/services/DispatchService.ts) | `R04` | `/resources/dispatch` |
