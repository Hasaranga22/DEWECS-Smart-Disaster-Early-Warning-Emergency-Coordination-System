import { SystemClock } from "./Clock";
import { UuidGenerator } from "./IdGenerator";
import { InMemoryTransactionRunner } from "./TransactionRunner";
import { PrismaTransactionRunner } from "./prisma/PrismaTransactionRunner";

// Global infra singletons
export const prodClock = new SystemClock();
export const prodIdGenerator = new UuidGenerator();

const dataStoreEnv = (process.env.DATA_STORE ?? "").trim().replace(/^["']|["']$/g, "");
export const isPrisma = dataStoreEnv === "prisma";

// ============================================================================
// Composition Root - Module Registrations
// ============================================================================

// [UC1 WARNING REGISTRATION PLACEHOLDER]
// export const uc1 = ...

// [UC2 REPORT REGISTRATION PLACEHOLDER]
import { createUc2Module } from "@/modules/uc2-report";
import { InMemoryReportRepository } from "@/modules/uc2-report/adapters/InMemoryReportRepository";
import { InMemoryAuditRepository } from "@/modules/uc2-report/adapters/InMemoryAuditRepository";
import { DecisionQueryService } from "@/modules/uc2-report/services/DecisionQueryService";
import { createUc4Module } from "@/modules/uc4-analysis";
import type { AuditLogger } from "@/modules/uc4-analysis/adapters/AuditLogger";
import { MockPartnerChannel } from "@/modules/uc4-analysis/adapters/MockPartnerChannel";
import { PrismaShareLogRepository } from "@/modules/uc4-analysis/adapters/prisma/PrismaShareLogRepository";
import { PrismaSnapshotRepository } from "@/modules/uc4-analysis/adapters/prisma/PrismaSnapshotRepository";
import { PrismaSupplyStockReader } from "@/modules/uc4-analysis/adapters/prisma/PrismaSupplyStockReader";
import { PrismaAlertReader } from "@/modules/uc4-analysis/adapters/prisma/PrismaAlertReader";
import { PrismaAttemptReader } from "@/modules/uc4-analysis/adapters/prisma/PrismaAttemptReader";
import { PrismaOccupancyEventReader } from "@/modules/uc4-analysis/adapters/prisma/PrismaOccupancyEventReader";
import { PrismaDistributionReader } from "@/modules/uc4-analysis/adapters/prisma/PrismaDistributionReader";
import { PrismaOrganizationReader } from "@/modules/uc4-analysis/adapters/prisma/PrismaOrganizationReader";
import { InMemoryShareLogRepository } from "@/shared/infra/InMemoryShareLogRepository";
import { InMemorySnapshotRepository } from "@/shared/infra/InMemorySnapshotRepository";
import { InMemorySupplyStockReader } from "@/shared/infra/InMemorySupplyStockReader";
import { InMemoryAlertReader } from "@/shared/infra/InMemoryAlertReader";
import { InMemoryAttemptReader } from "@/shared/infra/InMemoryAttemptReader";
import { InMemoryOccupancyEventReader } from "@/shared/infra/InMemoryOccupancyEventReader";
import { InMemoryDistributionReader } from "@/shared/infra/InMemoryDistributionReader";
import { InMemoryOrganizationReader } from "@/shared/infra/InMemoryOrganizationReader";
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

import { buildUc3Seed } from "@/modules/uc3-resources/seed/buildUc3Seed";

if (!isPrisma) {
  const seedData = buildUc3Seed({
    districtsByName: {
      Colombo: "00000000-0000-4000-8000-000000000010",
      Gampaha: "00000000-0000-4000-8000-000000000020",
    },
    organizationsByName: {
      Government: "00000000-0000-4000-8000-000000000100",
      RedCross: "00000000-0000-4000-8000-000000000200",
      ArmedForces: "00000000-0000-4000-8000-000000000300",
      PrivateDonor: "00000000-0000-4000-8000-000000000400",
    },
  });
  seedData.shelters.forEach((s) => shelterRepo.save(s));
  seedData.teams.forEach((t) => teamRepo.save(t));
  seedData.stocks.forEach((st) => stockRepo.save(st));
}

// [UC4 ANALYSIS REGISTRATION]
const uc4SnapshotRepository = isPrisma
  ? new PrismaSnapshotRepository()
  : new InMemorySnapshotRepository();
const uc4ShareLogRepository = isPrisma
  ? new PrismaShareLogRepository()
  : new InMemoryShareLogRepository();

const alertReader = isPrisma
  ? new PrismaAlertReader()
  : new InMemoryAlertReader();
const attemptReader = isPrisma
  ? new PrismaAttemptReader()
  : new InMemoryAttemptReader();
const occupancyReader = isPrisma
  ? new PrismaOccupancyEventReader()
  : new InMemoryOccupancyEventReader();
const distributionReader = isPrisma
  ? new PrismaDistributionReader()
  : new InMemoryDistributionReader();
const supplyStockReader = isPrisma
  ? new PrismaSupplyStockReader()
  : new InMemorySupplyStockReader();
const decisionReader = new DecisionQueryService(audits);

const organizationReader = isPrisma
  ? new PrismaOrganizationReader()
  : new InMemoryOrganizationReader();
const partnerChannel = new MockPartnerChannel({ next: () => Math.random() }, 0.2);

const auditLogger: AuditLogger = {
  logGeneration: (reportId, actorId) =>
    console.log(`[audit] report ${reportId} generated by ${actorId}`),
  logFailure: (reason, actorId) =>
    console.log(`[audit] generation failed (${reason}) by ${actorId}`),
  logShare: (reportId, outcomes, actorId) =>
    console.log(
      `[audit] report ${reportId} shared with ${outcomes.length} recipient(s) by ${actorId}`,
    ),
};

export const uc4 = createUc4Module({
  snapshotRepository: uc4SnapshotRepository,
  shareLogRepository: uc4ShareLogRepository,
  alertReader,
  attemptReader,
  decisionReader,
  occupancyReader,
  distributionReader,
  supplyStockReader,
  organizationReader,
  partnerChannel,
  auditLogger,
  clock: prodClock,
  idGenerator: prodIdGenerator,
});
