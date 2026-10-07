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

import { PrismaReportRepository } from "@/modules/uc2-report/adapters/PrismaReportRepository";
import { PrismaAuditRepository } from "@/modules/uc2-report/adapters/PrismaAuditRepository";

// 2. Initialize Repositories conditionally based on environment variable
const isPrisma = process.env.DATA_STORE === "prisma";

export const reports = isPrisma ? new PrismaReportRepository() : new InMemoryReportRepository();
export const audits = isPrisma ? new PrismaAuditRepository() : new InMemoryAuditRepository();

// 3. Wire the UC2 Module
// This `uc2` object is exported and used by all API routes.
export const uc2 = createUc2Module({
  reports,
  audits,
  clock: prodClock,
  ids: prodIdGenerator,
});
