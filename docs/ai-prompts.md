# AI Prompts Appendix (SE3070 Assignment 02 - Group 20)

## Member: SANDARUWAN H M K (IT23633322) - UC3 Emergency Resources

### Prompt 1: Phase 0 Shared Contracts & Base Infrastructure Implementation
- **Prompt Content:** "Implement shared contracts (types.ts, VerifiedEvidenceProvider, DistrictNotificationStore, AlertReader, AttemptReader, ReportDecisionReader, OccupancyEventReader, DistributionReader, Clock, IdGenerator) and shared infra (errors, http errorResponse, Repository, InMemoryRepository, TransactionRunner, FakeClock, SequentialIdGenerator, Prisma client, container skeleton)."
- **What I Checked / Changed:** 
  - Verified all contract signatures return `Promise<...>` for async compatibility with Prisma 7 per CONTEXT.md rule 9.
  - Verified `SequentialIdGenerator` produces valid UUID-v4 formatted strings (`00000000-0000-4000-8000-000000000001`).
  - Added unit tests in `src/shared/infra/__tests__/` and verified all 20 tests pass.

### Prompt 2: Phase 1 UC3 Domain Model, Services, Adapters, Seed & Vitest Suite
- **Prompt Content:** "Build UC3 core domain entities (Shelter withOccupancy, RescueTeam + TeamState pattern, SupplyStock withDeduction, OccupancyEvent, Distribution, DispatchRequest, ConflictQueueItem, ProcessedAction), strategy dispatch rules (CrossOrganizationRule, CrossDistrictRule), services (ShelterService, DispatchService, DistributionService, DashboardService, ConflictQueue, IdempotentCommandExecutor), seed builder, and Vitest suite for R01-R10."
- **What I Checked / Changed:**
  - Enforced exact test IDs in every Vitest test name (`R01` through `R10`, `ROLES`, `CONFLICT`, etc.).
  - Verified `Shelter.status` is derived (`FULL` iff `occupancy === capacity`).
  - Verified `DistributionService` executes inside `TransactionRunner` and never touches shelter occupancy.
  - Ran `npm run test:uc3` measuring **86.25% line coverage** and saved output to `docs/test-results/uc3-coverage.txt`.

### Prompt 3: Phase 2 Prisma 7 Adapters & Next.js API Routes
- **Prompt Content:** "Build Prisma repositories for every UC3 model with optimistic locking (`updateMany({ where: { id, version }, data: { ..., version: { increment: 1 } } })`), PrismaTransactionRunner, wire container.ts, seed hook in `prisma/seed.ts`, and create 9 API routes under `src/app/api/resources/` with zod validation, role checking, single service call, and `toErrorResponse` error mapping."
- **What I Checked / Changed:**
  - Checked Next.js 16 breaking change: route handler `context.params` is a Promise and must be awaited (`const { id } = await context.params`).
  - Created temporary actor helper `src/app/api/resources/_lib/tempActor.ts` marked `"TEMPORARY - delete when src/shared/access merges"`.
  - Ran `npx prisma generate` and `npx tsc --noEmit` to verify clean compilation with 0 errors.

### Prompt 4: Phase 3 UI Screens & Browser Offline Action Queue
- **Prompt Content:** "Build responsive UI under `/resources` (Dashboard SA-1, Dispatch SA-2, Distribution SA-3, Shelters SA-4) matching Group 18 wireframes + Group 20 required changes, sidebar navigation layout, alert banners, dialog modals, custom shadcn styling, and browser offline queue `OfflineActionQueue` with unit tests."
- **What I Checked / Changed:**
  - Checked that occupancy progress bars display explicit text e.g., `380 / 400 (95%)`.
  - Checked that dispatch status is read-only system-set text (no manual radio buttons).
  - Checked that cross-org and cross-district dispatch triggers a single combined confirmation alert dialog.
  - Verified client browser `actionId = crypto.randomUUID()` is generated and reused on retries.
  - Tested `OfflineActionQueue` unit tests (`4 passed`).

### Prompt 5: Phase 4 Documentation & Evidence Artifacts
- **Prompt Content:** "Generate PlantUML sequence diagram (`seq-uc3-resources.puml`), class diagram (`class-resources.puml`), code quality audit (`code-quality-audit.md`), traceability matrix (`uc3-traceability.md`), demo script (`uc3-demo-script.md`), report evidence (`uc3-report-evidence.md`), and AI prompts appendix."
- **What I Checked / Changed:**
  - Verified sequence diagram uses `EN_ROUTE` (not `DISPATCHED`), includes alt/opt/loop fragments, and has no `newpage`.
  - Filled every cell in the traceability matrix with source file, test ID, and route path (0 empty cells).
  - Audited code quality limits (complexity &lt;= 8, function length &lt;= 25, params &lt;= 3, 0 clones, 0 cycles).
