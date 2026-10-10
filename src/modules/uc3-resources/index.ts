import { Clock } from "@/shared/contracts/Clock";
import { IdGenerator } from "@/shared/contracts/IdGenerator";
import { DistrictNotificationStore } from "@/shared/contracts/DistrictNotificationStore";
import { TransactionRunner } from "@/shared/infra/TransactionRunner";

import { ShelterRepository } from "./adapters/repositories/ShelterRepository";
import { RescueTeamRepository } from "./adapters/repositories/RescueTeamRepository";
import { SupplyStockRepository } from "./adapters/repositories/SupplyStockRepository";
import { OccupancyEventRepository } from "./adapters/repositories/OccupancyEventRepository";
import { DistributionRepository } from "./adapters/repositories/DistributionRepository";
import { TeamStatusEventRepository } from "./adapters/repositories/TeamStatusEventRepository";
import { ProcessedActionRepository } from "./adapters/repositories/ProcessedActionRepository";
import { ConflictQueueRepository } from "./adapters/repositories/ConflictQueueRepository";
import { DispatchRequestRepository } from "./adapters/repositories/DispatchRequestRepository";

import { PartnerNotifier, LoggingPartnerNotifier } from "./adapters/ports/PartnerNotifier";
import { DistrictAdjacency, StaticDistrictAdjacency } from "./adapters/ports/DistrictAdjacency";

import { ProcessedActionStore } from "./services/ProcessedActionStore";
import { IdempotentCommandExecutor } from "./services/IdempotentCommandExecutor";
import { ConflictQueue } from "./services/ConflictQueue";
import { ShelterService } from "./services/ShelterService";
import { DispatchService } from "./services/DispatchService";
import { DistributionService } from "./services/DistributionService";
import { DashboardService } from "./services/DashboardService";
import { OccupancyEventQueryService } from "./services/OccupancyEventQueryService";
import { DistributionQueryService } from "./services/DistributionQueryService";
import { CrossOrganizationRule, CrossDistrictRule } from "./services/rules/DispatchRule";

export interface Uc3ModuleDeps {
  shelterRepo: ShelterRepository;
  teamRepo: RescueTeamRepository;
  stockRepo: SupplyStockRepository;
  occupancyEventRepo: OccupancyEventRepository;
  distributionRepo: DistributionRepository;
  teamStatusEventRepo: TeamStatusEventRepository;
  processedActionRepo: ProcessedActionRepository;
  conflictQueueRepo: ConflictQueueRepository;
  dispatchRequestRepo: DispatchRequestRepository;
  transactionRunner: TransactionRunner;
  notificationStore: DistrictNotificationStore;
  clock: Clock;
  idGenerator: IdGenerator;
  partnerNotifier?: PartnerNotifier;
  adjacency?: DistrictAdjacency;
}

export interface Uc3Module {
  shelters: ShelterService;
  dispatch: DispatchService;
  distributions: DistributionService;
  dashboard: DashboardService;
  conflictQueue: ConflictQueue;
  occupancyReader: OccupancyEventQueryService;
  distributionReader: DistributionQueryService;
}

/**
 * Factory creating and wiring the UC3 Emergency Resources module.
 */
export function createUc3Module(deps: Uc3ModuleDeps): Uc3Module {
  const partnerNotifier = deps.partnerNotifier ?? new LoggingPartnerNotifier();
  const adjacency = deps.adjacency ?? new StaticDistrictAdjacency();

  const actionStore = new ProcessedActionStore(deps.processedActionRepo, deps.clock);
  const executor = new IdempotentCommandExecutor(actionStore);
  const conflictQueue = new ConflictQueue(deps.conflictQueueRepo, deps.clock, deps.idGenerator);

  const shelterService = new ShelterService(
    deps.shelterRepo,
    deps.occupancyEventRepo,
    conflictQueue,
    executor,
    deps.clock,
    deps.idGenerator
  );

  const dispatchRules = [new CrossOrganizationRule(), new CrossDistrictRule()];
  const dispatchService = new DispatchService(
    deps.teamRepo,
    deps.teamStatusEventRepo,
    deps.dispatchRequestRepo,
    partnerNotifier,
    adjacency,
    dispatchRules,
    executor,
    deps.clock,
    deps.idGenerator
  );

  const distributionService = new DistributionService(
    deps.stockRepo,
    deps.distributionRepo,
    deps.transactionRunner,
    executor,
    deps.clock,
    deps.idGenerator
  );

  const dashboardService = new DashboardService(
    deps.shelterRepo,
    deps.teamRepo,
    deps.stockRepo,
    deps.conflictQueueRepo,
    deps.dispatchRequestRepo,
    deps.notificationStore,
    deps.clock
  );

  const occupancyReader = new OccupancyEventQueryService(deps.occupancyEventRepo);
  const distributionReader = new DistributionQueryService(deps.distributionRepo, deps.stockRepo);

  return {
    shelters: shelterService,
    dispatch: dispatchService,
    distributions: distributionService,
    dashboard: dashboardService,
    conflictQueue,
    occupancyReader,
    distributionReader,
  };
}
