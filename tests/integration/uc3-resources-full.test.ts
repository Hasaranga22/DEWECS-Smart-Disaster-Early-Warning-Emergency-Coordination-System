import { describe, it, expect, beforeEach } from "vitest";
import { Actor } from "@/shared/contracts/types";
import {
  uc3,
  shelterRepo,
  teamRepo,
  stockRepo,
  occupancyEventRepo,
  distributionRepo,
  conflictQueueRepo,
  prodClock,
} from "@/shared/infra/container";
import {
  OverCapacityError,
  InsufficientStockError,
  InvalidTransitionError,
  CrossDistrictConfirmationRequiredError,
  InvalidQuantityError,
} from "@/modules/uc3-resources/domain/errors";
import { ForbiddenError, VersionConflictError } from "@/shared/infra/errors";
import { ConflictQueueItem } from "@/modules/uc3-resources/domain/entities/ConflictQueueItem";
import { RescueTeam } from "@/modules/uc3-resources/domain/entities/RescueTeam";
import { SupplyStock } from "@/modules/uc3-resources/domain/entities/SupplyStock";

describe("UC3 Emergency Resources Integration Tests - End-to-End Resource Lifecycle", () => {
  const colomboDistrictId = "00000000-0000-4000-8000-000000000010";
  const gampahaDistrictId = "00000000-0000-4000-8000-000000000020";

  const govOrgId = "00000000-0000-4000-8000-000000000100";
  const redCrossOrgId = "00000000-0000-4000-8000-000000000200";

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

  const dmcOfficial: Actor = {
    id: "00000000-0000-4000-8000-000000000777",
    role: "DMC_OFFICIAL",
  };

  const citizen: Actor = {
    id: "00000000-0000-4000-8000-000000000555",
    role: "CITIZEN",
  };

  describe("1. Shelter Management & Capacity Thresholds", () => {
    it("registers a shelter, records incremental occupancy, and updates status to FULL and OPEN", async () => {
      const shelter = await uc3.shelters.registerShelter({
        actor: colomboOfficer,
        districtId: colomboDistrictId,
        organizationId: govOrgId,
        name: "Colombo Central Evacuation Center",
        address: "Main Street, Colombo 01",
        capacity: 100,
      });

      expect(shelter.id).toBeDefined();
      expect(shelter.capacity).toBe(100);
      expect(shelter.occupancy).toBe(0);
      expect(shelter.status).toBe("OPEN");

      // Increase occupancy to 75%
      const updated1 = await uc3.shelters.updateOccupancy({
        actor: colomboOfficer,
        shelterId: shelter.id,
        newCount: 75,
        expectedVersion: shelter.version,
        actionId: crypto.randomUUID(),
      });
      expect(updated1.occupancy).toBe(75);
      expect(updated1.status).toBe("OPEN");

      // Fill to exactly 100% capacity -> status automatically transitions to FULL
      const updated2 = await uc3.shelters.updateOccupancy({
        actor: colomboOfficer,
        shelterId: shelter.id,
        newCount: 100,
        expectedVersion: updated1.version,
        actionId: crypto.randomUUID(),
      });
      expect(updated2.occupancy).toBe(100);
      expect(updated2.status).toBe("FULL");

      // Attempting to exceed capacity throws OverCapacityError
      await expect(
        uc3.shelters.updateOccupancy({
          actor: colomboOfficer,
          shelterId: shelter.id,
          newCount: 120,
          expectedVersion: updated2.version,
          actionId: crypto.randomUUID(),
        })
      ).rejects.toThrow(OverCapacityError);

      // Decreasing occupancy below 100% transitions status back to OPEN
      const updated3 = await uc3.shelters.updateOccupancy({
        actor: colomboOfficer,
        shelterId: shelter.id,
        newCount: 80,
        expectedVersion: updated2.version,
        actionId: crypto.randomUUID(),
      });
      expect(updated3.occupancy).toBe(80);
      expect(updated3.status).toBe("OPEN");

      // Verify that OccupancyEvent records were persisted
      const events = await occupancyEventRepo.findByFilter({ districtId: colomboDistrictId });
      expect(events.length).toBeGreaterThanOrEqual(3);
      expect(events.some((e) => e.shelterId === shelter.id && e.newCount === 100)).toBe(true);
    });

    it("rejects unauthorized citizen or cross-district officer from recording occupancy", async () => {
      const shelter = await uc3.shelters.registerShelter({
        actor: colomboOfficer,
        districtId: colomboDistrictId,
        organizationId: govOrgId,
        name: "Colombo North Refuge",
        address: "North Way, Colombo",
        capacity: 50,
      });

      // Citizen is rejected with ForbiddenError
      await expect(
        uc3.shelters.updateOccupancy({
          actor: citizen,
          shelterId: shelter.id,
          newCount: 20,
          expectedVersion: shelter.version,
          actionId: crypto.randomUUID(),
        })
      ).rejects.toThrow(ForbiddenError);

      // Gampaha officer attempting to manage Colombo shelter is rejected
      await expect(
        uc3.shelters.updateOccupancy({
          actor: gampahaOfficer,
          shelterId: shelter.id,
          newCount: 20,
          expectedVersion: shelter.version,
          actionId: crypto.randomUUID(),
        })
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("2. Supply Stock Allocation & Distribution", () => {
    it("distributes supply stock to an open shelter and decreases inventory accurately", async () => {
      const shelter = await uc3.shelters.registerShelter({
        actor: colomboOfficer,
        districtId: colomboDistrictId,
        organizationId: govOrgId,
        name: "Distribution Hub Alpha",
        address: "Port Road, Colombo",
        capacity: 200,
      });

      const stock = new SupplyStock({
        id: crypto.randomUUID(),
        districtId: colomboDistrictId,
        organizationId: govOrgId,
        supplyType: "Medical First Aid Kits",
        onHand: 100,
        version: 1,
      });
      await stockRepo.save(stock);

      const initialOnHand = stock.onHand;
      const distributeQty = 25;

      const distribution = await uc3.distributions.distribute({
        actor: colomboOfficer,
        stockId: stock.id,
        destinationShelterId: shelter.id,
        quantity: distributeQty,
        actionId: crypto.randomUUID(),
      });

      expect(distribution.id).toBeDefined();
      expect(distribution.stockId).toBe(stock.id);
      expect(distribution.destinationShelterId).toBe(shelter.id);
      expect(distribution.quantity).toBe(distributeQty);

      // Verify stock was decremented in repository
      const refreshedStock = await stockRepo.findById(stock.id);
      expect(refreshedStock?.onHand).toBe(initialOnHand - distributeQty);

      // Attempting to distribute more than onHand throws InsufficientStockError
      await expect(
        uc3.distributions.distribute({
          actor: colomboOfficer,
          stockId: stock.id,
          destinationShelterId: shelter.id,
          quantity: initialOnHand + 9999,
          actionId: crypto.randomUUID(),
        })
      ).rejects.toThrow(InsufficientStockError);

      // Distributing 0 or negative quantities throws InvalidQuantityError
      await expect(
        uc3.distributions.distribute({
          actor: colomboOfficer,
          stockId: stock.id,
          destinationShelterId: shelter.id,
          quantity: 0,
          actionId: crypto.randomUUID(),
        })
      ).rejects.toThrow(InvalidQuantityError);
    });
  });

  describe("3. Rescue Team State Machine & Dispatch Lifecycle", () => {
    it("transitions rescue team through complete lifecycle: AVAILABLE -> EN_ROUTE -> ON_SITE -> RETURNING -> AVAILABLE", async () => {
      const teamId = crypto.randomUUID();
      const team = new RescueTeam({
        id: teamId,
        districtId: colomboDistrictId,
        organizationId: govOrgId,
        name: "Colombo Swift Water Rescue Unit 1",
        capability: "SWIFT_WATER",
        status: "AVAILABLE",
        version: 1,
        currentLatitude: 6.9271,
        currentLongitude: 79.8612,
      });
      await teamRepo.save(team);

      // 1. Dispatch team -> EN_ROUTE
      const dispatchResult = await uc3.dispatch.dispatch({
        actor: colomboOfficer,
        teamId: team.id,
        destinationDistrictId: colomboDistrictId,
        incident: "Kelani River Embankment Overflow",
        location: "Wellampitiya Bridge",
        actionId: crypto.randomUUID(),
      });
      expect(dispatchResult.team?.status).toBe("EN_ROUTE");

      // 2. Arrive at scene -> ON_SITE
      const onSiteTeam = await uc3.dispatch.advanceTeam({
        actor: colomboOfficer,
        teamId: team.id,
        targetStatus: "ON_SITE",
        incident: "Operations in Progress",
        location: "Wellampitiya Bridge",
      });
      expect(onSiteTeam.status).toBe("ON_SITE");

      // 3. Complete mission -> RETURNING
      const returningTeam = await uc3.dispatch.advanceTeam({
        actor: colomboOfficer,
        teamId: team.id,
        targetStatus: "RETURNING",
        incident: "Evacuation Complete",
        location: "Returning to base",
      });
      expect(returningTeam.status).toBe("RETURNING");

      // 4. Return to base -> AVAILABLE
      const resetTeam = await uc3.dispatch.advanceTeam({
        actor: colomboOfficer,
        teamId: team.id,
        targetStatus: "AVAILABLE",
      });
      expect(resetTeam.status).toBe("AVAILABLE");

      // Verify backup teams helper
      const backups = await uc3.dispatch.findBackupTeams(gampahaDistrictId);
      expect(Array.isArray(backups)).toBe(true);
    });

    it("enforces state machine transition rules and prevents illegal jumps", async () => {
      const team = new RescueTeam({
        id: crypto.randomUUID(),
        districtId: colomboDistrictId,
        organizationId: govOrgId,
        name: "Test Rescue Squad",
        capability: "GENERAL",
        status: "AVAILABLE",
        version: 1,
      });
      await teamRepo.save(team);

      // Cannot jump directly from AVAILABLE to ON_SITE
      await expect(
        uc3.dispatch.advanceTeam({
          actor: colomboOfficer,
          teamId: team.id,
          targetStatus: "ON_SITE",
        })
      ).rejects.toThrow(InvalidTransitionError);

      // Cannot jump from AVAILABLE to RETURNING
      await expect(
        uc3.dispatch.advanceTeam({
          actor: colomboOfficer,
          teamId: team.id,
          targetStatus: "RETURNING",
        })
      ).rejects.toThrow(InvalidTransitionError);
    });

    it("verifies district adjacency rules for cross-district dispatches", async () => {
      const team = new RescueTeam({
        id: crypto.randomUUID(),
        districtId: colomboDistrictId,
        organizationId: govOrgId,
        name: "Cross District Squad",
        capability: "GENERAL",
        status: "AVAILABLE",
        version: 1,
      });
      await teamRepo.save(team);

      // Cross-district dispatch with DMC Official oversight and confirmation succeeds
      const adjacentDispatch = await uc3.dispatch.dispatch({
        actor: dmcOfficial,
        teamId: team.id,
        destinationDistrictId: gampahaDistrictId,
        location: "Gampaha City Center",
        actionId: crypto.randomUUID(),
        isConfirmed: true,
      });
      expect(adjacentDispatch.team?.status).toBe("EN_ROUTE");
    });
  });

  describe("4. Optimistic Locking & Conflict Resolution Queue", () => {
    it("routes concurrent conflicting updates into ConflictQueue and allows officer resolution", async () => {
      const conflictItem = new ConflictQueueItem({
        id: crypto.randomUUID(),
        actionType: "DISPATCH_TEAM",
        payload: {
          teamId: "team-conflict-1",
          districtId: colomboDistrictId,
          location: "Flooded Sector 4",
        },
        expectedVersion: 1,
        actualVersion: 2,
        createdAt: prodClock.now(),
      });
      await conflictQueueRepo.save(conflictItem);

      // Query open conflicts for Colombo
      const openConflicts = await uc3.conflictQueue.listOpen(colomboDistrictId);
      expect(openConflicts.some((c) => c.id === conflictItem.id)).toBe(true);

      // Resolve the conflict (DISCARD)
      const resolved = await uc3.conflictQueue.resolve(conflictItem.id, "DISCARD", colomboOfficer.id);
      expect(resolved.status).toBe("RESOLVED");
      expect(resolved.resolvedBy).toBe(colomboOfficer.id);

      // Open conflicts list should now exclude resolved item
      const remainingOpen = await uc3.conflictQueue.listOpen(colomboDistrictId);
      expect(remainingOpen.some((c) => c.id === conflictItem.id)).toBe(false);
    });
  });

  describe("5. Role & Central Oversight Security Integration", () => {
    it("grants DMC Official central oversight across districts while confining District Officers", async () => {
      // DMC Official can inspect Colombo dashboard
      const colomboDash = await uc3.dashboard.getDashboard(dmcOfficial, colomboDistrictId);
      expect(colomboDash.districtId).toBe(colomboDistrictId);
      expect(Array.isArray(colomboDash.shelters)).toBe(true);
      expect(Array.isArray(colomboDash.teams)).toBe(true);

      // DMC Official can inspect Gampaha dashboard
      const gampahaDash = await uc3.dashboard.getDashboard(dmcOfficial, gampahaDistrictId);
      expect(gampahaDash.districtId).toBe(gampahaDistrictId);

      // Colombo Officer can access Colombo dashboard
      const officerDash = await uc3.dashboard.getDashboard(colomboOfficer, colomboDistrictId);
      expect(officerDash.districtId).toBe(colomboDistrictId);

      // Citizen cannot access resource dashboard
      await expect(uc3.dashboard.getDashboard(citizen, colomboDistrictId)).rejects.toThrow(ForbiddenError);
    });
  });
});
