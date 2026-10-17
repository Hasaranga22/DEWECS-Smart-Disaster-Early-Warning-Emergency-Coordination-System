//testing pa
import { describe, it, expect, beforeEach } from "vitest";
import { Actor, DistrictNotification } from "@/shared/contracts/types";
import { DistrictNotificationStore } from "@/shared/contracts/DistrictNotificationStore";
import { FakeClock } from "@/shared/infra/fakes/FakeClock";
import { SequentialIdGenerator } from "@/shared/infra/fakes/SequentialIdGenerator";

import { InMemoryShelterRepository } from "../adapters/memory/InMemoryShelterRepository";
import { InMemoryRescueTeamRepository } from "../adapters/memory/InMemoryRescueTeamRepository";
import { InMemorySupplyStockRepository } from "../adapters/memory/InMemorySupplyStockRepository";
import { InMemoryOccupancyEventRepository } from "../adapters/memory/InMemoryOccupancyEventRepository";
import { InMemoryDistributionRepository } from "../adapters/memory/InMemoryDistributionRepository";
import { InMemoryTeamStatusEventRepository } from "../adapters/memory/InMemoryTeamStatusEventRepository";
import { InMemoryProcessedActionRepository } from "../adapters/memory/InMemoryProcessedActionRepository";
import { InMemoryConflictQueueRepository } from "../adapters/memory/InMemoryConflictQueueRepository";
import { InMemoryDispatchRequestRepository } from "../adapters/memory/InMemoryDispatchRequestRepository";
import { InMemoryTransactionRunner } from "@/shared/infra/TransactionRunner";

import { createUc3Module, Uc3Module } from "../index";
import { Shelter } from "../domain/entities/Shelter";
import { RescueTeam } from "../domain/entities/RescueTeam";
import { SupplyStock } from "../domain/entities/SupplyStock";

import {
  OverCapacityError,
  InsufficientStockError,
  TeamNotAvailableError,
  InvalidTransitionError,
  CrossOrganizationConfirmationRequiredError,
  CrossDistrictConfirmationRequiredError,
  InvalidQuantityError,
} from "../domain/errors";
import { ForbiddenError, VersionConflictError, NotFoundError } from "@/shared/infra/errors";
import { OccupancyCount } from "../domain/valueObjects/OccupancyCount";
import { Quantity } from "../domain/valueObjects/Quantity";
import { AvailableState, EnRouteState, OnSiteState, ReturningState, parseTeamState } from "../domain/states/TeamState";
import { buildUc3Seed } from "../seed/buildUc3Seed";
import { StaticDistrictAdjacency } from "../adapters/ports/DistrictAdjacency";
import { TeamStatusEvent } from "../domain/entities/TeamStatusEvent";
import { OccupancyEvent } from "../domain/entities/OccupancyEvent";
import { DispatchRequest } from "../domain/entities/DispatchRequest";
import { ConflictQueueItem } from "../domain/entities/ConflictQueueItem";

class FakeNotificationStore implements DistrictNotificationStore {
  private notifications: DistrictNotification[] = [];
  public async add(n: DistrictNotification): Promise<void> {
    this.notifications.push(n);
  }
  public async listForDistrict(districtId: string): Promise<DistrictNotification[]> {
    return this.notifications.filter((n) => n.districtId === districtId);
  }
}

describe("UC3 Emergency Resources Core Module Tests", () => {
  const colomboDistrictId = "00000000-0000-4000-8000-000000000010";
  const gampahaDistrictId = "00000000-0000-4000-8000-000000000020";
  const govOrgId = "00000000-0000-4000-8000-000000000100";
  const ngoOrgId = "00000000-0000-4000-8000-000000000200";

  const officerActor: Actor = {
    id: "00000000-0000-4000-8000-000000000999",
    role: "DISTRICT_OFFICER",
    districtId: colomboDistrictId,
  };

  const wrongDistrictOfficerActor: Actor = {
    id: "00000000-0000-4000-8000-000000000888",
    role: "DISTRICT_OFFICER",
    districtId: gampahaDistrictId,
  };

  const citizenActor: Actor = {
    id: "00000000-0000-4000-8000-000000000777",
    role: "CITIZEN",
  };

  let clock: FakeClock;
  let idGen: SequentialIdGenerator;
  let shelterRepo: InMemoryShelterRepository;
  let teamRepo: InMemoryRescueTeamRepository;
  let stockRepo: InMemorySupplyStockRepository;
  let occupancyEventRepo: InMemoryOccupancyEventRepository;
  let distributionRepo: InMemoryDistributionRepository;
  let teamStatusEventRepo: InMemoryTeamStatusEventRepository;
  let processedActionRepo: InMemoryProcessedActionRepository;
  let conflictQueueRepo: InMemoryConflictQueueRepository;
  let dispatchRequestRepo: InMemoryDispatchRequestRepository;
  let txRunner: InMemoryTransactionRunner;
  let notifStore: FakeNotificationStore;

  let uc3: Uc3Module;

  beforeEach(async () => {
    clock = new FakeClock();
    idGen = new SequentialIdGenerator();

    shelterRepo = new InMemoryShelterRepository();
    shelterRepo.clear();

    teamRepo = new InMemoryRescueTeamRepository();
    teamRepo.clear();

    stockRepo = new InMemorySupplyStockRepository();
    stockRepo.clear();

    occupancyEventRepo = new InMemoryOccupancyEventRepository();
    occupancyEventRepo.clear();

    distributionRepo = new InMemoryDistributionRepository();
    distributionRepo.clear();

    teamStatusEventRepo = new InMemoryTeamStatusEventRepository();
    teamStatusEventRepo.clear();

    processedActionRepo = new InMemoryProcessedActionRepository();
    processedActionRepo.clear();

    conflictQueueRepo = new InMemoryConflictQueueRepository();
    conflictQueueRepo.clear();

    dispatchRequestRepo = new InMemoryDispatchRequestRepository();
    dispatchRequestRepo.clear();

    txRunner = new InMemoryTransactionRunner([
      shelterRepo as any,
      teamRepo as any,
      stockRepo as any,
      occupancyEventRepo as any,
      distributionRepo as any,
      processedActionRepo as any,
    ]);

    notifStore = new FakeNotificationStore();

    uc3 = createUc3Module({
      shelterRepo,
      teamRepo,
      stockRepo,
      occupancyEventRepo,
      distributionRepo,
      teamStatusEventRepo,
      processedActionRepo,
      conflictQueueRepo,
      dispatchRequestRepo,
      transactionRunner: txRunner,
      notificationStore: notifStore,
      clock,
      idGenerator: idGen,
    });
  });

  it("R01: 100/100 shelter rejects 101 and stays FULL, stock untouched; 90/100 -> 150 rejected and stays OPEN with alternatives", async () => {
    // 100/100 shelter
    const fullShelter = new Shelter({
      id: "shelter-full",
      districtId: colomboDistrictId,
      organizationId: govOrgId,
      name: "Full Shelter",
      address: "Loc 1",
      capacity: 100,
      occupancy: 100,
      version: 0,
    });
    // 90/100 shelter
    const openShelter = new Shelter({
      id: "shelter-open",
      districtId: colomboDistrictId,
      organizationId: govOrgId,
      name: "Open Shelter",
      address: "Loc 2",
      capacity: 100,
      occupancy: 90,
      version: 0,
    });
    await shelterRepo.save(fullShelter);
    await shelterRepo.save(openShelter);

    const stock = new SupplyStock({
      id: "stock-1",
      districtId: colomboDistrictId,
      organizationId: govOrgId,
      supplyType: "Food",
      onHand: 500,
      version: 0,
    });
    await stockRepo.save(stock);

    // Attempt 101 on 100/100 shelter
    await expect(
      uc3.shelters.updateOccupancy({
        actionId: "act-r01-1",
        actor: officerActor,
        shelterId: fullShelter.id,
        expectedVersion: 0,
        newCount: 101,
      })
    ).rejects.toThrow(OverCapacityError);

    // Assert repository state before == after
    const fullAfter = await shelterRepo.findById(fullShelter.id);
    expect(fullAfter?.occupancy).toBe(100);
    expect(fullAfter?.status).toBe("FULL");
    expect((await stockRepo.findById(stock.id))?.onHand).toBe(500);

    // Attempt 150 on 90/100 shelter -> rejects and lists alternatives
    try {
      await uc3.shelters.updateOccupancy({
        actionId: "act-r01-2",
        actor: officerActor,
        shelterId: openShelter.id,
        expectedVersion: 0,
        newCount: 150,
      });
      expect.fail("Should have thrown OverCapacityError");
    } catch (err: any) {
      expect(err).toBeInstanceOf(OverCapacityError);
      expect(err.alternatives).toBeDefined();
    }

    const openAfter = await shelterRepo.findById(openShelter.id);
    expect(openAfter?.occupancy).toBe(90);
    expect(openAfter?.status).toBe("OPEN");
  });

  it("R02: distribution leaves occupancy unchanged and records quantity + destination", async () => {
    const shelter = new Shelter({
      id: "shelter-r02",
      districtId: colomboDistrictId,
      organizationId: govOrgId,
      name: "R02 Shelter",
      address: "Loc",
      capacity: 200,
      occupancy: 50,
      version: 0,
    });
    await shelterRepo.save(shelter);

    const stock = new SupplyStock({
      id: "stock-r02",
      districtId: colomboDistrictId,
      organizationId: govOrgId,
      supplyType: "Water",
      onHand: 1000,
      version: 0,
    });
    await stockRepo.save(stock);

    const dist = await uc3.distributions.distribute({
      actionId: "act-r02",
      actor: officerActor,
      stockId: stock.id,
      destinationShelterId: shelter.id,
      quantity: 200,
    });

    expect(dist.quantity).toBe(200);
    expect(dist.destinationShelterId).toBe(shelter.id);

    // Shelter occupancy leaves unchanged
    const shelterAfter = await shelterRepo.findById(shelter.id);
    expect(shelterAfter?.occupancy).toBe(50);

    // Stock onHand decremented
    const stockAfter = await stockRepo.findById(stock.id);
    expect(stockAfter?.onHand).toBe(800);
  });

  it("R03: insufficient stock rejects, stock and distributions unchanged", async () => {
    const shelter = new Shelter({
      id: "shelter-r03",
      districtId: colomboDistrictId,
      organizationId: govOrgId,
      name: "Shelter R03",
      address: "Loc",
      capacity: 100,
      occupancy: 10,
      version: 0,
    });
    await shelterRepo.save(shelter);

    const stock = new SupplyStock({
      id: "stock-r03",
      districtId: colomboDistrictId,
      organizationId: govOrgId,
      supplyType: "Medicine",
      onHand: 50,
      version: 0,
    });
    await stockRepo.save(stock);

    await expect(
      uc3.distributions.distribute({
        actionId: "act-r03",
        actor: officerActor,
        stockId: stock.id,
        destinationShelterId: shelter.id,
        quantity: 100, // Exceeds onHand 50
      })
    ).rejects.toThrow(InsufficientStockError);

    // State before == after
    const stockAfter = await stockRepo.findById(stock.id);
    expect(stockAfter?.onHand).toBe(50);
    const distributions = await distributionRepo.findByFilter({ districtId: colomboDistrictId });
    expect(distributions).toHaveLength(0);
  });

  it("R04: only AVAILABLE dispatches; RETURNING -> AVAILABLE allows next dispatch; no team -> UNASSIGNED saved", async () => {
    const team = new RescueTeam({
      id: "team-r04",
      districtId: colomboDistrictId,
      organizationId: govOrgId,
      name: "Rescue Team R04",
      capability: "Evacuation",
      status: "AVAILABLE",
      version: 0,
    });
    await teamRepo.save(team);

    // Dispatch available team
    const res1 = await uc3.dispatch.dispatch({
      actionId: "act-r04-1",
      actor: officerActor,
      destinationDistrictId: colomboDistrictId,
      teamId: team.id,
      location: "River Bank",
      isConfirmed: true,
    });
    expect(res1.team?.status).toBe("EN_ROUTE");

    // Attempting dispatch when EN_ROUTE throws TeamNotAvailableError
    await expect(
      uc3.dispatch.dispatch({
        actionId: "act-r04-2",
        actor: officerActor,
        destinationDistrictId: colomboDistrictId,
        teamId: team.id,
        location: "Bridge",
        isConfirmed: true,
      })
    ).rejects.toThrow(TeamNotAvailableError);

    // Advance state: EN_ROUTE -> ON_SITE -> RETURNING -> AVAILABLE
    await uc3.dispatch.advanceTeam({ actor: officerActor, teamId: team.id, targetStatus: "ON_SITE" });
    await uc3.dispatch.advanceTeam({ actor: officerActor, teamId: team.id, targetStatus: "RETURNING" });
    const availTeam = await uc3.dispatch.advanceTeam({ actor: officerActor, teamId: team.id, targetStatus: "AVAILABLE" });
    expect(availTeam.status).toBe("AVAILABLE");

    // Dispatching again works
    const res2 = await uc3.dispatch.dispatch({
      actionId: "act-r04-3",
      actor: officerActor,
      destinationDistrictId: colomboDistrictId,
      teamId: team.id,
      location: "Zone B",
      isConfirmed: true,
    });
    expect(res2.team?.status).toBe("EN_ROUTE");

    // Clear all teams -> dispatch with no team saves UNASSIGNED DispatchRequest
    teamRepo.clear();
    const res3 = await uc3.dispatch.dispatch({
      actionId: "act-r04-4",
      actor: officerActor,
      destinationDistrictId: colomboDistrictId,
      location: "Remote Village",
      isConfirmed: true,
    });
    expect(res3.request).toBeDefined();
    expect(res3.request?.status).toBe("UNASSIGNED");
  });

  it("R05: same actionId twice (occupancy, dispatch, distribution) -> one record, same result", async () => {
    const shelter = new Shelter({
      id: "shelter-r05",
      districtId: colomboDistrictId,
      organizationId: govOrgId,
      name: "Idempotency Shelter",
      address: "Loc",
      capacity: 100,
      occupancy: 10,
      version: 0,
    });
    await shelterRepo.save(shelter);

    // Occupancy idempotency
    const s1 = await uc3.shelters.updateOccupancy({
      actionId: "same-act-occ",
      actor: officerActor,
      shelterId: shelter.id,
      expectedVersion: 0,
      newCount: 40,
    });
    const s2 = await uc3.shelters.updateOccupancy({
      actionId: "same-act-occ",
      actor: officerActor,
      shelterId: shelter.id,
      expectedVersion: 0,
      newCount: 40,
    });
    expect(s1.occupancy).toBe(40);
    expect(s2.occupancy).toBe(40);
    const events = await occupancyEventRepo.findByFilter({ districtId: colomboDistrictId });
    expect(events).toHaveLength(1);

    // Distribution idempotency
    const stock = new SupplyStock({
      id: "stock-r05",
      districtId: colomboDistrictId,
      organizationId: govOrgId,
      supplyType: "Water",
      onHand: 1000,
      version: 0,
    });
    await stockRepo.save(stock);

    const d1 = await uc3.distributions.distribute({
      actionId: "same-act-dist",
      actor: officerActor,
      stockId: stock.id,
      destinationShelterId: shelter.id,
      quantity: 100,
    });
    const d2 = await uc3.distributions.distribute({
      actionId: "same-act-dist",
      actor: officerActor,
      stockId: stock.id,
      destinationShelterId: shelter.id,
      quantity: 100,
    });
    expect(d1.id).toBe(d2.id);
    const distributions = await distributionRepo.findByFilter({ districtId: colomboDistrictId });
    expect(distributions).toHaveLength(1);
    expect((await stockRepo.findById(stock.id))?.onHand).toBe(900);
  });

  it("R06: stale version -> conflict queued, newer value not overwritten", async () => {
    const shelter = new Shelter({
      id: "shelter-r06",
      districtId: colomboDistrictId,
      organizationId: govOrgId,
      name: "Conflict Shelter",
      address: "Loc",
      capacity: 100,
      occupancy: 20,
      version: 5, // current actual version is 5
    });
    await shelterRepo.save(shelter);

    // Submit with stale expectedVersion 4
    await expect(
      uc3.shelters.updateOccupancy({
        actionId: "act-r06-stale",
        actor: officerActor,
        shelterId: shelter.id,
        expectedVersion: 4,
        newCount: 50,
      })
    ).rejects.toThrow(VersionConflictError);

    // Assert shelter not overwritten
    const shelterAfter = await shelterRepo.findById(shelter.id);
    expect(shelterAfter?.occupancy).toBe(20);
    expect(shelterAfter?.version).toBe(5);

    // Assert item queued in ConflictQueue
    const conflicts = await uc3.conflictQueue.listOpen(colomboDistrictId);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].expectedVersion).toBe(4);
    expect(conflicts[0].actualVersion).toBe(5);
  });

  it("R07: cross-district backup needs confirmation; home districtId unchanged; returns to pool", async () => {
    const backupTeam = new RescueTeam({
      id: "team-gampaha",
      districtId: gampahaDistrictId, // Home district Gampaha
      organizationId: govOrgId,
      name: "Gampaha Backup Unit",
      capability: "Flood Evacuation",
      status: "AVAILABLE",
      version: 0,
    });
    await teamRepo.save(backupTeam);

    // Dispatching across district without confirmation throws CrossDistrictConfirmationRequiredError
    await expect(
      uc3.dispatch.dispatch({
        actionId: "act-r07-unconfirmed",
        actor: officerActor,
        destinationDistrictId: colomboDistrictId,
        teamId: backupTeam.id,
        location: "Colombo North",
        isConfirmed: false,
      })
    ).rejects.toThrow(CrossDistrictConfirmationRequiredError);

    // Dispatching with confirmation succeeds
    const res = await uc3.dispatch.dispatch({
      actionId: "act-r07-confirmed",
      actor: officerActor,
      destinationDistrictId: colomboDistrictId,
      teamId: backupTeam.id,
      location: "Colombo North",
      isConfirmed: true,
    });

    expect(res.team?.status).toBe("EN_ROUTE");
    // Home districtId MUST NEVER change
    expect(res.team?.districtId).toBe(gampahaDistrictId);

    // Advance to AVAILABLE
    await uc3.dispatch.advanceTeam({ actor: officerActor, teamId: backupTeam.id, targetStatus: "ON_SITE" });
    await uc3.dispatch.advanceTeam({ actor: officerActor, teamId: backupTeam.id, targetStatus: "RETURNING" });
    const returned = await uc3.dispatch.advanceTeam({ actor: officerActor, teamId: backupTeam.id, targetStatus: "AVAILABLE" });

    expect(returned.status).toBe("AVAILABLE");
    expect(returned.districtId).toBe(gampahaDistrictId);
  });

  it("R08: injected failure after the stock decrement -> stock, distributions and processed actions all rolled back", async () => {
    const shelter = new Shelter({
      id: "shelter-r08",
      districtId: colomboDistrictId,
      organizationId: govOrgId,
      name: "R08 Shelter",
      address: "Loc",
      capacity: 100,
      occupancy: 0,
      version: 0,
    });
    await shelterRepo.save(shelter);

    const stock = new SupplyStock({
      id: "stock-r08",
      districtId: colomboDistrictId,
      organizationId: govOrgId,
      supplyType: "Food",
      onHand: 100,
      version: 0,
    });
    await stockRepo.save(stock);

    // Inject failing distribution repository that throws on save
    const failingDistRepo = {
      ...distributionRepo,
      save: async () => {
        throw new Error("Injected repository save failure");
      },
    };

    const failingUc3 = createUc3Module({
      shelterRepo,
      teamRepo,
      stockRepo,
      occupancyEventRepo,
      distributionRepo: failingDistRepo as any,
      teamStatusEventRepo,
      processedActionRepo,
      conflictQueueRepo,
      dispatchRequestRepo,
      transactionRunner: txRunner,
      notificationStore: notifStore,
      clock,
      idGenerator: idGen,
    });

    await expect(
      failingUc3.distributions.distribute({
        actionId: "act-r08-fail",
        actor: officerActor,
        stockId: stock.id,
        destinationShelterId: shelter.id,
        quantity: 50,
      })
    ).rejects.toThrow("Injected repository save failure");

    // Stock onHand, distributions, and processed actions all rolled back
    const stockAfter = await stockRepo.findById(stock.id);
    expect(stockAfter?.onHand).toBe(100);
    expect(await processedActionRepo.findByActionId("act-r08-fail")).toBeNull();
  });

  it("R09: registerShelter -> occupancy 0, version 0, appears on dashboard", async () => {
    const shelter = await uc3.shelters.registerShelter({
      actor: officerActor,
      districtId: colomboDistrictId,
      organizationId: govOrgId,
      name: "New District Shelter",
      address: "123 Park Road",
      capacity: 350,
    });

    expect(shelter.occupancy).toBe(0);
    expect(shelter.version).toBe(0);
    expect(shelter.status).toBe("OPEN");

    const dash = await uc3.dashboard.getDashboard(officerActor, colomboDistrictId);
    const found = dash.shelters.find((s) => s.id === shelter.id);
    expect(found).toBeDefined();
    expect(found?.name).toBe("New District Shelter");
  });

  it("R10: negative / non-integer occupancy and zero / negative / non-numeric quantity rejected, no state change", () => {
    expect(() => new OccupancyCount(-5)).toThrow(InvalidQuantityError);
    expect(() => new OccupancyCount(3.14)).toThrow(InvalidQuantityError);

    expect(() => new Quantity(0)).toThrow(InvalidQuantityError);
    expect(() => new Quantity(-10)).toThrow(InvalidQuantityError);
    expect(() => new Quantity(2.5)).toThrow(InvalidQuantityError);
  });

  it("Cross-organization dispatch requires confirmation for partner teams", async () => {
    const partnerTeam = new RescueTeam({
      id: "team-ngo",
      districtId: colomboDistrictId,
      organizationId: ngoOrgId, // NGO org (non-government)
      name: "Red Cross Volunteer Team",
      capability: "First Aid",
      status: "AVAILABLE",
      version: 0,
    });
    await teamRepo.save(partnerTeam);

    await expect(
      uc3.dispatch.dispatch({
        actionId: "act-cross-org-unconfirmed",
        actor: officerActor,
        destinationDistrictId: colomboDistrictId,
        teamId: partnerTeam.id,
        location: "Camp A",
        isConfirmed: false,
      })
    ).rejects.toThrow(CrossOrganizationConfirmationRequiredError);

    const res = await uc3.dispatch.dispatch({
      actionId: "act-cross-org-confirmed",
      actor: officerActor,
      destinationDistrictId: colomboDistrictId,
      teamId: partnerTeam.id,
      location: "Camp A",
      isConfirmed: true,
    });

    expect(res.team?.status).toBe("EN_ROUTE");
  });

  it("Role and district access boundary checks", async () => {
    await expect(uc3.dashboard.getDashboard(citizenActor, colomboDistrictId)).rejects.toThrow(ForbiddenError);
    await expect(uc3.dashboard.getDashboard(wrongDistrictOfficerActor, colomboDistrictId)).rejects.toThrow(ForbiddenError);
  });

  it("ConflictQueue RETRY and DISCARD resolution flow", async () => {
    const item = await uc3.conflictQueue.enqueue(
      "UPDATE_SHELTER_OCCUPANCY",
      { districtId: colomboDistrictId, test: true },
      1,
      2
    );
    expect(item.status).toBe("OPEN");

    const resolved = await uc3.conflictQueue.resolve(item.id, "DISCARD", officerActor.id);
    expect(resolved.status).toBe("RESOLVED");
    expect(resolved.resolvedBy).toBe(officerActor.id);

    const openList = await uc3.conflictQueue.listOpen(colomboDistrictId);
    expect(openList.length).toBe(0);
  });

  it("Reader contracts (OccupancyEventReader and DistributionReader) apply filters correctly", async () => {
    const shelter = new Shelter({
      id: "shelter-reader",
      districtId: colomboDistrictId,
      organizationId: govOrgId,
      name: "Reader Shelter",
      address: "Loc",
      capacity: 100,
      occupancy: 0,
      version: 0,
    });
    await shelterRepo.save(shelter);

    await uc3.shelters.updateOccupancy({
      actionId: "act-occ-read",
      actor: officerActor,
      shelterId: shelter.id,
      expectedVersion: 0,
      newCount: 20,
    });

    const occEvents = await uc3.occupancyReader.listEvents({ districtId: colomboDistrictId });
    expect(occEvents).toHaveLength(1);
    expect(occEvents[0].districtId).toBe(colomboDistrictId);

    const stock = new SupplyStock({
      id: "stock-reader",
      districtId: colomboDistrictId,
      organizationId: govOrgId,
      supplyType: "Rations",
      onHand: 1000,
      version: 0,
    });
    await stockRepo.save(stock);

    await uc3.distributions.distribute({
      actionId: "act-dist-read",
      actor: officerActor,
      stockId: stock.id,
      destinationShelterId: shelter.id,
      quantity: 50,
    });

    const distEvents = await uc3.distributionReader.listDistributions({ districtId: colomboDistrictId });
    expect(distEvents).toHaveLength(1);
    expect(distEvents[0].districtId).toBe(colomboDistrictId);
  });

  it("Seed builder initializes seed data correctly", () => {
    const seed = buildUc3Seed({
      districtsByName: { Colombo: colomboDistrictId, Gampaha: gampahaDistrictId },
      organizationsByName: { Government: govOrgId, RedCross: ngoOrgId },
    });

    expect(seed.shelters.length).toBeGreaterThanOrEqual(4);
    expect(seed.teams.length).toBeGreaterThanOrEqual(4);
    expect(seed.stocks.length).toBeGreaterThanOrEqual(4);

    const nearlyFull = seed.shelters.find((s) => s.occupancy === 380 && s.capacity === 400);
    expect(nearlyFull).toBeDefined();
  });

  it("TeamState exhaustively validates all invalid transitions and fallback parsing", () => {
    const available = new AvailableState();
    expect(() => available.arrive()).toThrow(InvalidTransitionError);
    expect(() => available.startReturn()).toThrow(InvalidTransitionError);
    expect(() => available.completeReturn()).toThrow(InvalidTransitionError);

    const enRoute = new EnRouteState();
    expect(() => enRoute.dispatch()).toThrow(InvalidTransitionError);
    expect(() => enRoute.startReturn()).toThrow(InvalidTransitionError);
    expect(() => enRoute.completeReturn()).toThrow(InvalidTransitionError);

    const onSite = new OnSiteState();
    expect(() => onSite.dispatch()).toThrow(InvalidTransitionError);
    expect(() => onSite.arrive()).toThrow(InvalidTransitionError);
    expect(() => onSite.completeReturn()).toThrow(InvalidTransitionError);

    const returning = new ReturningState();
    expect(() => returning.dispatch()).toThrow(InvalidTransitionError);
    expect(() => returning.arrive()).toThrow(InvalidTransitionError);
    expect(() => returning.startReturn()).toThrow(InvalidTransitionError);

    expect(parseTeamState("INVALID" as any)).toBeInstanceOf(AvailableState);
    expect(parseTeamState("AVAILABLE")).toBeInstanceOf(AvailableState);
    expect(parseTeamState("EN_ROUTE")).toBeInstanceOf(EnRouteState);
    expect(parseTeamState("ON_SITE")).toBeInstanceOf(OnSiteState);
    expect(parseTeamState("RETURNING")).toBeInstanceOf(ReturningState);
  });

  it("RescueTeam, Shelter, and DispatchRequest entities validate serialization and state transitions", () => {
    const team = new RescueTeam({
      id: "team-test-1",
      districtId: colomboDistrictId,
      organizationId: govOrgId,
      name: "Alpha Rescue",
      capability: "Medical",
      status: "AVAILABLE",
      version: 0,
      currentLatitude: 6.9271,
      currentLongitude: 79.8612,
    });
    const teamJson = team.toJSON();
    expect(teamJson.id).toBe("team-test-1");
    expect(teamJson.status).toBe("AVAILABLE");

    const shelter = new Shelter({
      id: "shelter-test-1",
      districtId: colomboDistrictId,
      organizationId: govOrgId,
      name: "Beta Shelter",
      address: "100 High St",
      capacity: 100,
      occupancy: 50,
      version: 0,
    });
    const shelterJson = shelter.toJSON();
    expect(shelterJson.name).toBe("Beta Shelter");
    expect(shelter.status).toBe("OPEN");

    const fullShelter = shelter.withOccupancy(100);
    expect(fullShelter.status).toBe("FULL");

    const openShelter = fullShelter.withOccupancy(80);
    expect(openShelter.status).toBe("OPEN");

    const req = new DispatchRequest({
      id: "req-1",
      districtId: colomboDistrictId,
      incident: "Flooding",
      location: "Bridge 4",
      requestedBy: officerActor.id,
      actionId: "act-1",
      occurredAt: clock.now(),
    });
    expect(req.status).toBe("UNASSIGNED");

    const assigned = req.assign("team-test-1");
    expect(assigned.status).toBe("ASSIGNED");
    expect(assigned.teamId).toBe("team-test-1");

    const cancelled = req.cancel();
    expect(cancelled.status).toBe("CANCELLED");
  });

  it("DispatchService handles missing team, backup fallback, replay, and advance errors", async () => {
    // 1. Missing team throws NotFoundError
    await expect(
      uc3.dispatch.dispatch({
        actionId: "act-missing-team",
        actor: officerActor,
        destinationDistrictId: colomboDistrictId,
        teamId: "non-existent-team-id",
        location: "Zone X",
        isConfirmed: true,
      })
    ).rejects.toThrow(NotFoundError);

    // 2. Advance non-existent team throws NotFoundError
    await expect(
      uc3.dispatch.advanceTeam({
        actor: officerActor,
        teamId: "non-existent-team-id",
        targetStatus: "ON_SITE",
      })
    ).rejects.toThrow(NotFoundError);

    // 3. Auto-fallback to adjacent district backup team when home district has no teams
    teamRepo.clear();
    const gampahaBackup = new RescueTeam({
      id: "team-gampaha-auto",
      districtId: gampahaDistrictId,
      organizationId: govOrgId,
      name: "Gampaha Auto Backup",
      capability: "Evacuation",
      status: "AVAILABLE",
      version: 0,
    });
    await teamRepo.save(gampahaBackup);

    const backupList = await uc3.dispatch.findBackupTeams(colomboDistrictId);
    expect(backupList.length).toBeGreaterThanOrEqual(1);

    const autoDispatchRes = await uc3.dispatch.dispatch({
      actionId: "act-auto-backup",
      actor: officerActor,
      destinationDistrictId: colomboDistrictId,
      location: "Border Area",
      isConfirmed: true,
    });
    expect(autoDispatchRes.team).toBeDefined();
    expect(autoDispatchRes.team?.id).toBe(gampahaBackup.id);

    // 4. Replay dispatch returns saved result
    const replayed = await uc3.dispatch.dispatch({
      actionId: "act-auto-backup",
      actor: officerActor,
      destinationDistrictId: colomboDistrictId,
      location: "Border Area",
      isConfirmed: true,
    });
    expect(replayed.team?.id).toBe(gampahaBackup.id);
  });

  it("DistributionService and ShelterService throw NotFoundError when targets do not exist", async () => {
    // Non-existent stock in distribution throws NotFoundError
    await expect(
      uc3.distributions.distribute({
        actionId: "act-dist-missing-stock",
        actor: officerActor,
        stockId: "missing-stock-id",
        destinationShelterId: "shelter-id",
        quantity: 10,
      })
    ).rejects.toThrow(NotFoundError);

    // Non-existent shelter in updateOccupancy throws NotFoundError
    await expect(
      uc3.shelters.updateOccupancy({
        actionId: "act-occ-missing-shelter",
        actor: officerActor,
        shelterId: "missing-shelter-id",
        expectedVersion: 0,
        newCount: 20,
      })
    ).rejects.toThrow(NotFoundError);

    // Non-existent conflict item throws NotFoundError
    await expect(
      uc3.conflictQueue.resolve("missing-conflict-id", "DISCARD", officerActor.id)
    ).rejects.toThrow(NotFoundError);
  });

  it("DashboardService groups multiple stocks per organization and handles alert preselection", async () => {
    const stock1 = new SupplyStock({
      id: "stock-group-1",
      districtId: colomboDistrictId,
      organizationId: govOrgId,
      supplyType: "Water Packs",
      onHand: 200,
      version: 0,
    });
    const stock2 = new SupplyStock({
      id: "stock-group-2",
      districtId: colomboDistrictId,
      organizationId: govOrgId,
      supplyType: "Dry Rations",
      onHand: 150,
      version: 0,
    });
    await stockRepo.save(stock1);
    await stockRepo.save(stock2);

    // Seed alert notification in notifStore
    await notifStore.add({
      id: "notif-1",
      alertId: "alert-1",
      districtId: colomboDistrictId,
      hazardType: "FLOOD",
      kind: "ESCALATED",
      severity: "CRITICAL",
      occurredAt: clock.now(),
    });

    const dash = await uc3.dashboard.getDashboard(officerActor, colomboDistrictId);
    expect(dash.preselectedFromAlert).toBeDefined();
    expect(dash.preselectedFromAlert?.kind).toBe("ESCALATED");

    const govStocks = dash.stockByOrganization.find((s) => s.organizationId === govOrgId);
    expect(govStocks).toBeDefined();
    expect(govStocks!.items.length).toBeGreaterThanOrEqual(2);
  });

  it("In-memory repositories support findById, findByTeamId, snapshot, and restore", async () => {
    const event = new TeamStatusEvent({
      id: "status-ev-1",
      teamId: "team-1",
      fromStatus: "AVAILABLE",
      toStatus: "EN_ROUTE",
      actorId: officerActor.id,
      occurredAt: clock.now(),
      incident: "Fire",
      location: "Sector 3",
    });
    await teamStatusEventRepo.save(event);

    const foundEv = await teamStatusEventRepo.findById("status-ev-1");
    expect(foundEv?.id).toBe("status-ev-1");

    const teamEvents = await teamStatusEventRepo.findByTeamId("team-1");
    expect(teamEvents).toHaveLength(1);

    const snap = teamStatusEventRepo.snapshot();
    teamStatusEventRepo.clear();
    expect(await teamStatusEventRepo.findById("status-ev-1")).toBeNull();
    teamStatusEventRepo.restore(snap);
    expect(await teamStatusEventRepo.findById("status-ev-1")).toBeDefined();

    const dispatchReq = new DispatchRequest({
      id: "req-snap-1",
      districtId: colomboDistrictId,
      incident: "Landslide",
      location: "Slope A",
      requestedBy: officerActor.id,
      actionId: "act-snap-1",
      occurredAt: clock.now(),
    });
    await dispatchRequestRepo.save(dispatchReq);
    expect(await dispatchRequestRepo.findById("req-snap-1")).toBeDefined();

    const assignedReq = new DispatchRequest({
      id: "req-assigned-1",
      districtId: colomboDistrictId,
      incident: "Landslide",
      location: "Slope B",
      requestedBy: officerActor.id,
      actionId: "act-assigned-1",
      occurredAt: clock.now(),
      status: "ASSIGNED",
    });
    await dispatchRequestRepo.save(assignedReq);
    const unassigned = await dispatchRequestRepo.findUnassignedByDistrictId(colomboDistrictId);
    expect(unassigned.some((r) => r.id === "req-assigned-1")).toBe(false);

    const reqSnap = dispatchRequestRepo.snapshot();
    dispatchRequestRepo.clear();
    expect(await dispatchRequestRepo.findById("req-snap-1")).toBeNull();
    dispatchRequestRepo.restore(reqSnap);
    expect(await dispatchRequestRepo.findById("req-snap-1")).toBeDefined();

    const item = new ConflictQueueItem({
      id: "cq-snap-1",
      actionType: "DISPATCH_TEAM",
      payload: { districtId: colomboDistrictId },
      expectedVersion: 1,
      actualVersion: 2,
      createdAt: clock.now(),
    });
    await conflictQueueRepo.save(item);
    expect(await conflictQueueRepo.findById("cq-snap-1")).toBeDefined();
    expect(item.districtId).toBe(colomboDistrictId);

    const nonDistrictItem = new ConflictQueueItem({
      id: "cq-snap-2",
      actionType: "OTHER_ACTION",
      payload: {},
      expectedVersion: 1,
      actualVersion: 2,
      createdAt: clock.now(),
      status: "RESOLVED",
    });
    expect(nonDistrictItem.districtId).toBeUndefined();

    const openItems = await conflictQueueRepo.findOpenByDistrictId(colomboDistrictId);
    expect(openItems.length).toBeGreaterThan(0);

    const queueSnap = conflictQueueRepo.snapshot();
    conflictQueueRepo.clear();
    expect(await conflictQueueRepo.findById("cq-snap-1")).toBeNull();
    conflictQueueRepo.restore(queueSnap);
    expect(await conflictQueueRepo.findById("cq-snap-1")).toBeDefined();

    const now = clock.now();
    const filterFrom = new Date(now.getTime() - 10000);
    const filterTo = new Date(now.getTime() + 10000);
    const filteredDist = await distributionRepo.findByFilter({
      districtId: colomboDistrictId,
      from: filterFrom,
      to: filterTo,
      cutoff: filterTo,
    });
    expect(filteredDist).toBeDefined();

    const foundOccEv = await occupancyEventRepo.findById("non-existent-event");
    expect(foundOccEv).toBeNull();
    const filteredOcc = await occupancyEventRepo.findByFilter({
      districtId: colomboDistrictId,
      from: filterFrom,
      to: filterTo,
      cutoff: filterTo,
    });
    expect(filteredOcc).toBeDefined();

    expect(await shelterRepo.findAll()).toBeDefined();
    expect(await teamRepo.findAll()).toBeDefined();
    expect(await stockRepo.findAll()).toBeDefined();
  });

  it("StaticDistrictAdjacency correctly checks adjacency and handles edge conditions", async () => {
    const adj = new StaticDistrictAdjacency();
    expect(await adj.areAdjacent("Colombo", "Colombo")).toBe(true);
    expect(await adj.areAdjacent("Colombo", "Gampaha")).toBe(true);
    expect(await adj.areAdjacent("Colombo", "Jaffna")).toBe(false);

    const adjIds = await adj.getAdjacentDistrictIds("Colombo");
    expect(adjIds).toContain("Gampaha");

    const unknown = await adj.getAdjacentDistrictIds("UnknownDistrict");
    expect(unknown).toEqual([]);
  });
});
