import { describe, it, expect, beforeEach } from "vitest";
import { DashboardService } from "../services/DashboardService";
import { InMemoryShelterRepository } from "../adapters/memory/InMemoryShelterRepository";
import { InMemoryRescueTeamRepository } from "../adapters/memory/InMemoryRescueTeamRepository";
import { InMemorySupplyStockRepository } from "../adapters/memory/InMemorySupplyStockRepository";
import { InMemoryConflictQueueRepository } from "../adapters/memory/InMemoryConflictQueueRepository";
import { InMemoryDispatchRequestRepository } from "../adapters/memory/InMemoryDispatchRequestRepository";
import { FakeClock } from "@/shared/infra/fakes/FakeClock";
import { Actor, DistrictNotification } from "@/shared/contracts/types";
import { DistrictNotificationStore } from "@/shared/contracts/DistrictNotificationStore";
import { Shelter } from "../domain/entities/Shelter";
import { RescueTeam } from "../domain/entities/RescueTeam";
import { SupplyStock } from "../domain/entities/SupplyStock";
import { ConflictQueueItem } from "../domain/entities/ConflictQueueItem";
import { DispatchRequest } from "../domain/entities/DispatchRequest";
import { ForbiddenError } from "@/shared/infra/errors";

class MockNotificationStore implements DistrictNotificationStore {
  private notifications: DistrictNotification[] = [];
  public async add(n: DistrictNotification): Promise<void> {
    this.notifications.push(n);
  }
  public async listForDistrict(districtId: string): Promise<DistrictNotification[]> {
    return this.notifications.filter((n) => n.districtId === districtId);
  }
}

describe("DashboardService", () => {
  const colomboDistrictId = "00000000-0000-4000-8000-000000000010";
  const gampahaDistrictId = "00000000-0000-4000-8000-000000000020";
  const govOrgId = "00000000-0000-4000-8000-000000000100";
  const ngoOrgId = "00000000-0000-4000-8000-000000000200";

  const colomboOfficer: Actor = {
    id: "00000000-0000-4000-8000-000000000999",
    role: "DISTRICT_OFFICER",
    districtId: colomboDistrictId,
  };

  const dmcOfficial: Actor = {
    id: "00000000-0000-4000-8000-000000000777",
    role: "DMC_OFFICIAL",
  };

  const citizen: Actor = {
    id: "00000000-0000-4000-8000-000000000555",
    role: "CITIZEN",
  };

  let shelterRepo: InMemoryShelterRepository;
  let teamRepo: InMemoryRescueTeamRepository;
  let stockRepo: InMemorySupplyStockRepository;
  let conflictRepo: InMemoryConflictQueueRepository;
  let requestRepo: InMemoryDispatchRequestRepository;
  let notifStore: MockNotificationStore;
  let clock: FakeClock;
  let service: DashboardService;

  beforeEach(() => {
    shelterRepo = new InMemoryShelterRepository();
    shelterRepo.clear();
    teamRepo = new InMemoryRescueTeamRepository();
    teamRepo.clear();
    stockRepo = new InMemorySupplyStockRepository();
    stockRepo.clear();
    conflictRepo = new InMemoryConflictQueueRepository();
    conflictRepo.clear();
    requestRepo = new InMemoryDispatchRequestRepository();
    requestRepo.clear();
    notifStore = new MockNotificationStore();
    clock = new FakeClock();

    service = new DashboardService(
      shelterRepo,
      teamRepo,
      stockRepo,
      conflictRepo,
      requestRepo,
      notifStore,
      clock
    );
  });

  it("should assemble a complete dashboard payload for an authorized district officer", async () => {
    // Seed shelter
    await shelterRepo.save(
      new Shelter({
        id: "shelter-dash-1",
        districtId: colomboDistrictId,
        organizationId: govOrgId,
        name: "Central Haven",
        address: "Colombo",
        capacity: 100,
        occupancy: 20,
      })
    );

    // Seed team
    await teamRepo.save(
      new RescueTeam({
        id: "team-dash-1",
        districtId: colomboDistrictId,
        organizationId: govOrgId,
        name: "Swift Water 1",
        capability: "SWIFT_WATER",
        status: "AVAILABLE",
      })
    );

    // Seed stocks for two organizations
    await stockRepo.save(
      new SupplyStock({
        id: "stock-gov-1",
        districtId: colomboDistrictId,
        organizationId: govOrgId,
        supplyType: "Rations",
        onHand: 100,
      })
    );
    await stockRepo.save(
      new SupplyStock({
        id: "stock-ngo-1",
        districtId: colomboDistrictId,
        organizationId: ngoOrgId,
        supplyType: "Blankets",
        onHand: 200,
      })
    );

    // Seed an open conflict
    await conflictRepo.save(
      new ConflictQueueItem({
        id: "conflict-dash-1",
        actionType: "UPDATE_OCCUPANCY",
        payload: { districtId: colomboDistrictId },
        expectedVersion: 1,
        actualVersion: 2,
        createdAt: clock.now(),
      })
    );

    // Seed unassigned dispatch request
    await requestRepo.save(
      new DispatchRequest({
        id: "req-dash-1",
        districtId: colomboDistrictId,
        location: "Bridge 3",
        requestedBy: colomboOfficer.id,
        actionId: "act-1",
        occurredAt: clock.now(),
      })
    );

    const dashboard = await service.getDashboard(colomboOfficer, colomboDistrictId);

    expect(dashboard.districtId).toBe(colomboDistrictId);
    expect(dashboard.shelters).toHaveLength(1);
    expect(dashboard.teams).toHaveLength(1);
    expect(dashboard.stockByOrganization).toHaveLength(2);
    expect(dashboard.openConflicts).toHaveLength(1);
    expect(dashboard.unassignedDispatchRequests).toHaveLength(1);
  });

  it("should preselect the latest escalated hazard alert for the district", async () => {
    await notifStore.add({
      id: "notif-1",
      alertId: "alert-flood-1",
      districtId: colomboDistrictId,
      hazardType: "FLOOD",
      kind: "ESCALATED",
      severity: "CRITICAL",
      occurredAt: clock.now(),
    });

    const dashboard = await service.getDashboard(colomboOfficer, colomboDistrictId);

    expect(dashboard.preselectedFromAlert).toBeDefined();
    expect(dashboard.preselectedFromAlert?.alertId).toBe("alert-flood-1");
    expect(dashboard.preselectedFromAlert?.severity).toBe("CRITICAL");
  });

  it("should allow DMC Official to inspect any district dashboard", async () => {
    const dashboard = await service.getDashboard(dmcOfficial, gampahaDistrictId);
    expect(dashboard.districtId).toBe(gampahaDistrictId);
  });

  it("should throw ForbiddenError when citizen tries to view dashboard", async () => {
    await expect(service.getDashboard(citizen, colomboDistrictId)).rejects.toThrow(ForbiddenError);
  });
});
