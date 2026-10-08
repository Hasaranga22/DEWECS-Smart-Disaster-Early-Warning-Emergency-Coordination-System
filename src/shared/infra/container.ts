import { SystemClock } from "./Clock";
import { UuidGenerator } from "./IdGenerator";
import { InMemoryTransactionRunner } from "./TransactionRunner";
import { PrismaTransactionRunner } from "./prisma/PrismaTransactionRunner";

// Global infra singletons
export const prodClock = new SystemClock();
export const prodIdGenerator = new UuidGenerator();

export const isPrisma = process.env.DATA_STORE === "prisma";

// ============================================================================
// Composition Root - Module Registrations
// ============================================================================

// [UC1 WARNING REGISTRATION PLACEHOLDER]
// export const uc1 = ...

// [UC2 REPORT REGISTRATION PLACEHOLDER]
import { createUc2Module } from "@/modules/uc2-report";
import { InMemoryReportRepository } from "@/modules/uc2-report/adapters/InMemoryReportRepository";
import { InMemoryAuditRepository } from "@/modules/uc2-report/adapters/InMemoryAuditRepository";
import { PrismaReportRepository } from "@/modules/uc2-report/adapters/PrismaReportRepository";
import { PrismaAuditRepository } from "@/modules/uc2-report/adapters/PrismaAuditRepository";

export const reports = isPrisma ? new PrismaReportRepository() : new InMemoryReportRepository();
export const audits = isPrisma ? new PrismaAuditRepository() : new InMemoryAuditRepository();

export const uc2 = createUc2Module({
  reports,
  audits,
  clock: prodClock,
  ids: prodIdGenerator,
});

// [UC3 RESOURCES REGISTRATION]
import { createUc3Module } from "@/modules/uc3-resources";
import { InMemoryShelterRepository } from "@/modules/uc3-resources/adapters/memory/InMemoryShelterRepository";
import { InMemoryRescueTeamRepository } from "@/modules/uc3-resources/adapters/memory/InMemoryRescueTeamRepository";
import { InMemorySupplyStockRepository } from "@/modules/uc3-resources/adapters/memory/InMemorySupplyStockRepository";
import { InMemoryOccupancyEventRepository } from "@/modules/uc3-resources/adapters/memory/InMemoryOccupancyEventRepository";
import { InMemoryDistributionRepository } from "@/modules/uc3-resources/adapters/memory/InMemoryDistributionRepository";
import { InMemoryTeamStatusEventRepository } from "@/modules/uc3-resources/adapters/memory/InMemoryTeamStatusEventRepository";
import { InMemoryProcessedActionRepository } from "@/modules/uc3-resources/adapters/memory/InMemoryProcessedActionRepository";
import { InMemoryConflictQueueRepository } from "@/modules/uc3-resources/adapters/memory/InMemoryConflictQueueRepository";
import { InMemoryDispatchRequestRepository } from "@/modules/uc3-resources/adapters/memory/InMemoryDispatchRequestRepository";

import { PrismaShelterRepository } from "@/modules/uc3-resources/adapters/prisma/PrismaShelterRepository";
import { PrismaRescueTeamRepository } from "@/modules/uc3-resources/adapters/prisma/PrismaRescueTeamRepository";
import { PrismaSupplyStockRepository } from "@/modules/uc3-resources/adapters/prisma/PrismaSupplyStockRepository";
import { PrismaOccupancyEventRepository } from "@/modules/uc3-resources/adapters/prisma/PrismaOccupancyEventRepository";
import { PrismaDistributionRepository } from "@/modules/uc3-resources/adapters/prisma/PrismaDistributionRepository";
import { PrismaTeamStatusEventRepository } from "@/modules/uc3-resources/adapters/prisma/PrismaTeamStatusEventRepository";
import { PrismaProcessedActionRepository } from "@/modules/uc3-resources/adapters/prisma/PrismaProcessedActionRepository";
import { PrismaConflictQueueRepository } from "@/modules/uc3-resources/adapters/prisma/PrismaConflictQueueRepository";
import { PrismaDispatchRequestRepository } from "@/modules/uc3-resources/adapters/prisma/PrismaDispatchRequestRepository";

export const shelterRepo = isPrisma ? new PrismaShelterRepository() : new InMemoryShelterRepository();
export const teamRepo = isPrisma ? new PrismaRescueTeamRepository() : new InMemoryRescueTeamRepository();
export const stockRepo = isPrisma ? new PrismaSupplyStockRepository() : new InMemorySupplyStockRepository();
export const occupancyEventRepo = isPrisma ? new PrismaOccupancyEventRepository() : new InMemoryOccupancyEventRepository();
export const distributionRepo = isPrisma ? new PrismaDistributionRepository() : new InMemoryDistributionRepository();
export const teamStatusEventRepo = isPrisma ? new PrismaTeamStatusEventRepository() : new InMemoryTeamStatusEventRepository();
export const processedActionRepo = isPrisma ? new PrismaProcessedActionRepository() : new InMemoryProcessedActionRepository();
export const conflictQueueRepo = isPrisma ? new PrismaConflictQueueRepository() : new InMemoryConflictQueueRepository();
export const dispatchRequestRepo = isPrisma ? new PrismaDispatchRequestRepository() : new InMemoryDispatchRequestRepository();

export const uc3TxRunner = isPrisma
  ? new PrismaTransactionRunner()
  : new InMemoryTransactionRunner([
      shelterRepo as any,
      teamRepo as any,
      stockRepo as any,
      occupancyEventRepo as any,
      distributionRepo as any,
      processedActionRepo as any,
    ]);

// Mock notification store stub for UC3 container initialization
const mockNotificationStore = {
  add: async () => {},
  listForDistrict: async () => [],
};

export const uc3 = createUc3Module({
  shelterRepo,
  teamRepo,
  stockRepo,
  occupancyEventRepo,
  distributionRepo,
  teamStatusEventRepo,
  processedActionRepo,
  conflictQueueRepo,
  dispatchRequestRepo,
  transactionRunner: uc3TxRunner,
  notificationStore: mockNotificationStore,
  clock: prodClock,
  idGenerator: prodIdGenerator,
});

// [UC4 ANALYSIS REGISTRATION PLACEHOLDER]
// export const uc4 = ...
