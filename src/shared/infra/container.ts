import { createUc2Module } from "@/modules/uc2-report";
import { InMemoryReportRepository } from "@/modules/uc2-report/adapters/InMemoryReportRepository";
import { InMemoryAuditRepository } from "@/modules/uc2-report/adapters/InMemoryAuditRepository";
import { Clock, IdGenerator } from "@/shared/contracts/Clock";

// 1. Production implementations for infrastructure
const prodClock: Clock = {
  now: () => new Date(),
};

const prodIdGenerator: IdGenerator = {
  // Uses Node's built-in crypto module to generate standard UUIDs
  next: () => crypto.randomUUID(),
};

// 2. Initialize Repositories
// (In Phase 7, we will add an "if (process.env.DATA_STORE === 'prisma')" check here
// to swap these out for the Prisma versions).
export const reports = new InMemoryReportRepository();
export const audits = new InMemoryAuditRepository();

// 3. Wire the UC2 Module
// This `uc2` object is exported and used by all API routes.
export const uc2 = createUc2Module({
  reports,
  audits,
  clock: prodClock,
  ids: prodIdGenerator,
});
