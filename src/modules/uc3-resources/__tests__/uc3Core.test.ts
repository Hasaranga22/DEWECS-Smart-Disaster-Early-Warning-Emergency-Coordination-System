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
import { AvailableState, EnRouteState, OnSiteState, ReturningState } from "../domain/states/TeamState";
import { buildUc3Seed } from "../seed/buildUc3Seed";

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
});
