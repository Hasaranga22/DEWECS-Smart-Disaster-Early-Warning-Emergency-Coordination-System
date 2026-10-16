import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import {
  uc3,
  shelterRepo,
  stockRepo,
  occupancyEventRepo,
  distributionRepo,
} from "@/shared/infra/container";
import { GET as getDashboardRoute } from "@/app/api/resources/dashboard/route";
import { POST as postShelterRoute } from "@/app/api/resources/shelters/route";
import { POST as postOccupancyRoute } from "@/app/api/resources/shelters/[id]/occupancy/route";
import { POST as postDispatchRoute } from "@/app/api/resources/dispatch/route";
import { POST as postDistributionRoute } from "@/app/api/resources/distributions/route";
import { GET as getConflictsRoute } from "@/app/api/resources/conflicts/route";

describe("UC3 Cross-Module Integration Tests (UC1 -> UC3 -> UC4 & In-Process API Routes)", () => {
  const colomboDistrictId = "00000000-0000-4000-8000-000000000010";
  const govOrgId = "00000000-0000-4000-8000-000000000100";

  const colomboOfficerCookie = `dewecs-role=DISTRICT_OFFICER; x-dewecs-district-id=${colomboDistrictId}`;
  const citizenCookie = "dewecs-role=CITIZEN";

  describe("1. Cross-Module Contract Integration: UC3 Feeds UC4 Analysis Readers", () => {
    it("generates OccupancyEvents and Distributions in UC3 that are consumable by UC4 readers", async () => {
      const shelter = await uc3.shelters.registerShelter({
        actor: {
          id: "00000000-0000-4000-8000-000000000999",
          role: "DISTRICT_OFFICER",
          districtId: colomboDistrictId,
        },
        districtId: colomboDistrictId,
        organizationId: govOrgId,
        name: "UC4 Bridge Test Shelter",
        address: "Baseline Road, Colombo",
        capacity: 150,
      });

      // Record occupancy via UC3 domain service
      await uc3.shelters.updateOccupancy({
        actor: {
          id: "00000000-0000-4000-8000-000000000999",
          role: "DISTRICT_OFFICER",
          districtId: colomboDistrictId,
        },
        shelterId: shelter.id,
        newCount: 120,
        expectedVersion: shelter.version,
        actionId: crypto.randomUUID(),
      });

      // Distribute stock via UC3 domain service
      const allStocks = await stockRepo.findAll();
      let targetStock = allStocks.find(
        (s) => s.districtId === colomboDistrictId && s.organizationId === govOrgId && s.onHand >= 50
      );

      if (!targetStock) {
        const { SupplyStock } = await import("@/modules/uc3-resources/domain/entities/SupplyStock");
        targetStock = new SupplyStock({
          id: crypto.randomUUID(),
          districtId: colomboDistrictId,
          organizationId: govOrgId,
          supplyType: "Food Rations (Packs)",
          onHand: 500,
          version: 1,
        });
        await stockRepo.save(targetStock);
      }

      await uc3.distributions.distribute({
        actor: {
          id: "00000000-0000-4000-8000-000000000999",
          role: "DISTRICT_OFFICER",
          districtId: colomboDistrictId,
        },
        stockId: targetStock.id,
        destinationShelterId: shelter.id,
        quantity: 50,
        actionId: crypto.randomUUID(),
      });

      // Query through the contracts that UC4 relies on
      const occupancyEvents = await occupancyEventRepo.findByFilter({
        districtId: colomboDistrictId,
      });
      expect(occupancyEvents.length).toBeGreaterThan(0);
      expect(occupancyEvents.some((e) => e.shelterId === shelter.id && e.newCount === 120)).toBe(true);

      const distributions = await distributionRepo.findByFilter({
        districtId: colomboDistrictId,
      });
      expect(distributions.length).toBeGreaterThan(0);
      expect(distributions.some((d) => d.destinationShelterId === shelter.id && d.quantity === 50)).toBe(true);
    });
  });

  describe("2. In-Process HTTP Route Integration (/api/resources/*)", () => {
    it("GET /api/resources/dashboard returns 200 and complete overview for authenticated officer", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/resources/dashboard?districtId=${colomboDistrictId}`,
        {
          headers: {
            cookie: colomboOfficerCookie,
          },
        }
      );

      const res = await getDashboardRoute(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.districtId).toBe(colomboDistrictId);
      expect(Array.isArray(body.shelters)).toBe(true);
      expect(Array.isArray(body.teams)).toBe(true);
      expect(Array.isArray(body.stockByOrganization)).toBe(true);
    });

    it("POST /api/resources/shelters rejects unauthorized citizen with 403 Forbidden", async () => {
      const req = new NextRequest("http://localhost:3000/api/resources/shelters", {
        method: "POST",
        headers: {
          cookie: citizenCookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          districtId: colomboDistrictId,
          organizationId: govOrgId,
          name: "Illegal Shelter Attempt",
          address: "Citizen Road",
          capacity: 50,
        }),
      });

      const res = await postShelterRoute(req);
      expect(res.status).toBe(403);
    });

    it("POST /api/resources/shelters creates shelter for District Officer", async () => {
      const req = new NextRequest("http://localhost:3000/api/resources/shelters", {
        method: "POST",
        headers: {
          cookie: colomboOfficerCookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          districtId: colomboDistrictId,
          organizationId: govOrgId,
          name: "API Integrated Shelter",
          address: "Court Road, Colombo",
          capacity: 80,
        }),
      });

      const res = await postShelterRoute(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBeDefined();
      expect(data.capacity).toBe(80);
    });

    it("GET /api/resources/conflicts lists open conflict items", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/resources/conflicts?districtId=${colomboDistrictId}`,
        {
          headers: {
            cookie: colomboOfficerCookie,
          },
        }
      );

      const res = await getConflictsRoute(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });
});
