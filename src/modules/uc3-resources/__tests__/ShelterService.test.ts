import { describe, it, expect, beforeEach } from "vitest";
import { ShelterService } from "../services/ShelterService";
import { InMemoryShelterRepository } from "../adapters/memory/InMemoryShelterRepository";
import { InMemoryOccupancyEventRepository } from "../adapters/memory/InMemoryOccupancyEventRepository";
import { InMemoryConflictQueueRepository } from "../adapters/memory/InMemoryConflictQueueRepository";
import { InMemoryProcessedActionRepository } from "../adapters/memory/InMemoryProcessedActionRepository";
import { ConflictQueue } from "../services/ConflictQueue";
import { ProcessedActionStore } from "../services/ProcessedActionStore";
import { IdempotentCommandExecutor } from "../services/IdempotentCommandExecutor";
import { FakeClock } from "@/shared/infra/fakes/FakeClock";
import { SequentialIdGenerator } from "@/shared/infra/fakes/SequentialIdGenerator";
import { Actor } from "@/shared/contracts/types";
import { OverCapacityError } from "../domain/errors";
import { ForbiddenError, NotFoundError, VersionConflictError } from "@/shared/infra/errors";

describe("ShelterService", () => {
  const colomboDistrictId = "00000000-0000-4000-8000-000000000010";
  const gampahaDistrictId = "00000000-0000-4000-8000-000000000020";
  const govOrgId = "00000000-0000-4000-8000-000000000100";

  const colomboOfficer: Actor = {
    id: "00000000-0000-4000-8000-000000000999",
    role: "DISTRICT_OFFICER",
    districtId: colomboDistrictId,
  };

  const gampahaOfficer: Actor = {
    id: "00000000-0000-4000-8000-000000000888",
    role: "DISTRICT_OFFICER",
    districtId: gampahaDistrictId,
  };

  const citizen: Actor = {
    id: "00000000-0000-4000-8000-000000000555",
    role: "CITIZEN",
  };

  let shelterRepo: InMemoryShelterRepository;
  let eventRepo: InMemoryOccupancyEventRepository;
  let conflictRepo: InMemoryConflictQueueRepository;
  let actionRepo: InMemoryProcessedActionRepository;
  let conflictQueue: ConflictQueue;
  let executor: IdempotentCommandExecutor;
  let clock: FakeClock;
  let idGen: SequentialIdGenerator;
  let service: ShelterService;

  beforeEach(() => {
    shelterRepo = new InMemoryShelterRepository();
    shelterRepo.clear();
    eventRepo = new InMemoryOccupancyEventRepository();
    eventRepo.clear();
    conflictRepo = new InMemoryConflictQueueRepository();
    conflictRepo.clear();
    actionRepo = new InMemoryProcessedActionRepository();
    actionRepo.clear();
    clock = new FakeClock();
    idGen = new SequentialIdGenerator();

    conflictQueue = new ConflictQueue(conflictRepo, clock, idGen);
    const actionStore = new ProcessedActionStore(actionRepo, clock);
    executor = new IdempotentCommandExecutor(actionStore);

    service = new ShelterService(
      shelterRepo,
      eventRepo,
      conflictQueue,
      executor,
      clock,
      idGen
    );
  });

  it("should register a new shelter with initial zero occupancy and OPEN status", async () => {
    const shelter = await service.registerShelter({
      actor: colomboOfficer,
      districtId: colomboDistrictId,
      organizationId: govOrgId,
      name: "Colombo Central Shelter",
      address: "100 Galle Road, Colombo",
      capacity: 120,
    });

    expect(shelter.id).toBeDefined();
    expect(shelter.name).toBe("Colombo Central Shelter");
    expect(shelter.capacity).toBe(120);
    expect(shelter.occupancy).toBe(0);
    expect(shelter.status).toBe("OPEN");

    const saved = await shelterRepo.findById(shelter.id);
    expect(saved).not.toBeNull();
    expect(saved?.name).toBe("Colombo Central Shelter");
  });

  it("should update occupancy and persist an OccupancyEvent", async () => {
    const shelter = await service.registerShelter({
      actor: colomboOfficer,
      districtId: colomboDistrictId,
      organizationId: govOrgId,
      name: "St. Thomas Relief Center",
      address: "Mount Lavinia",
      capacity: 100,
    });

    const updated = await service.updateOccupancy({
      actor: colomboOfficer,
      actionId: "action-occ-1",
      shelterId: shelter.id,
      expectedVersion: shelter.version,
      newCount: 65,
    });

    expect(updated.occupancy).toBe(65);

    const events = await eventRepo.findByFilter({ districtId: colomboDistrictId });
    expect(events).toHaveLength(1);
    expect(events[0].shelterId).toBe(shelter.id);
    expect(events[0].previousCount).toBe(0);
    expect(events[0].newCount).toBe(65);
  });

  it("should automatically change status to FULL when occupancy reaches capacity", async () => {
    const shelter = await service.registerShelter({
      actor: colomboOfficer,
      districtId: colomboDistrictId,
      organizationId: govOrgId,
      name: "Modara Safe Haven",
      address: "Modara, Colombo 15",
      capacity: 80,
    });

    const fullShelter = await service.updateOccupancy({
      actor: colomboOfficer,
      actionId: "action-occ-full",
      shelterId: shelter.id,
      expectedVersion: shelter.version,
      newCount: 80,
    });

    expect(fullShelter.status).toBe("FULL");
  });

  it("should throw OverCapacityError and suggest alternative shelters when exceeding capacity", async () => {
    const shelter = await service.registerShelter({
      actor: colomboOfficer,
      districtId: colomboDistrictId,
      organizationId: govOrgId,
      name: "Small Relief Camp",
      address: "Ward Place, Colombo",
      capacity: 30,
    });

    // Register an alternative nearby shelter with free capacity
    await service.registerShelter({
      actor: colomboOfficer,
      districtId: colomboDistrictId,
      organizationId: govOrgId,
      name: "Alternate Haven",
      address: "Borella, Colombo",
      capacity: 100,
    });

    await expect(
      service.updateOccupancy({
        actor: colomboOfficer,
        actionId: "action-occ-over",
        shelterId: shelter.id,
        expectedVersion: shelter.version,
        newCount: 35,
      })
    ).rejects.toThrow(OverCapacityError);
  });

  it("should route version mismatches to ConflictQueue and throw VersionConflictError", async () => {
    const shelter = await service.registerShelter({
      actor: colomboOfficer,
      districtId: colomboDistrictId,
      organizationId: govOrgId,
      name: "Concurrency Center",
      address: "Colombo",
      capacity: 50,
    });

    // Provide an outdated version (e.g. expected 999 instead of 0)
    await expect(
      service.updateOccupancy({
        actor: colomboOfficer,
        actionId: "action-occ-conflict",
        shelterId: shelter.id,
        expectedVersion: 999,
        newCount: 20,
      })
    ).rejects.toThrow(VersionConflictError);

    const openConflicts = await conflictRepo.findOpenByDistrictId(colomboDistrictId);
    expect(openConflicts.length).toBeGreaterThanOrEqual(1);
    expect(openConflicts[0].actionType).toBe("UPDATE_SHELTER_OCCUPANCY");
  });

  it("should throw ForbiddenError when citizen or cross-district officer attempts update", async () => {
    const shelter = await service.registerShelter({
      actor: colomboOfficer,
      districtId: colomboDistrictId,
      organizationId: govOrgId,
      name: "Secure Shelter",
      address: "Colombo",
      capacity: 50,
    });

    await expect(
      service.updateOccupancy({
        actor: citizen,
        actionId: "action-citizen",
        shelterId: shelter.id,
        expectedVersion: shelter.version,
        newCount: 10,
      })
    ).rejects.toThrow(ForbiddenError);

    await expect(
      service.updateOccupancy({
        actor: gampahaOfficer,
        actionId: "action-wrong-district",
        shelterId: shelter.id,
        expectedVersion: shelter.version,
        newCount: 10,
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it("should throw NotFoundError when shelter does not exist", async () => {
    await expect(
      service.updateOccupancy({
        actor: colomboOfficer,
        actionId: "action-nonexistent",
        shelterId: "non-existent-id",
        expectedVersion: 0,
        newCount: 10,
      })
    ).rejects.toThrow(NotFoundError);
  });
});
