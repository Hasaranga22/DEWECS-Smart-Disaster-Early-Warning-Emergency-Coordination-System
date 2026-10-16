import { describe, it, expect } from "vitest";
import { RescueTeam } from "../domain/entities/RescueTeam";
import { InvalidTransitionError, TeamNotAvailableError } from "../domain/errors";

describe("RescueTeam (State Pattern Entity)", () => {
  const homeDistrictId = "00000000-0000-4000-8000-000000000010";
  const orgId = "00000000-0000-4000-8000-000000000100";

  it("should initialize with AVAILABLE status by default and preserve home district", () => {
    const team = new RescueTeam({
      id: "team-init-1",
      districtId: homeDistrictId,
      organizationId: orgId,
      name: "Alpha Swift Water",
      capability: "SWIFT_WATER",
    });

    expect(team.status).toBe("AVAILABLE");
    expect(team.districtId).toBe(homeDistrictId);
    expect(team.version).toBe(0);
  });

  it("should transition sequentially: AVAILABLE -> EN_ROUTE -> ON_SITE -> RETURNING -> AVAILABLE", () => {
    const team = new RescueTeam({
      id: "team-seq-1",
      districtId: homeDistrictId,
      organizationId: orgId,
      name: "Bravo Team",
      capability: "MEDICAL",
      status: "AVAILABLE",
    });

    // 1. Dispatch
    const dispatched = team.dispatch();
    expect(dispatched.status).toBe("EN_ROUTE");
    expect(dispatched.version).toBe(1);

    // 2. Arrive
    const arrived = dispatched.arrive();
    expect(arrived.status).toBe("ON_SITE");
    expect(arrived.version).toBe(2);

    // 3. Start Return
    const returning = arrived.startReturn();
    expect(returning.status).toBe("RETURNING");
    expect(returning.version).toBe(3);

    // 4. Complete Return
    const available = returning.completeReturn();
    expect(available.status).toBe("AVAILABLE");
    expect(available.version).toBe(3);
  });

  it("should throw TeamNotAvailableError when attempting to dispatch a team that is not AVAILABLE", () => {
    const team = new RescueTeam({
      id: "team-busy",
      districtId: homeDistrictId,
      organizationId: orgId,
      name: "Charlie Team",
      capability: "GENERAL",
      status: "EN_ROUTE",
    });

    expect(() => team.dispatch()).toThrow(TeamNotAvailableError);
  });

  it("should throw InvalidTransitionError on invalid state jumps", () => {
    const availableTeam = new RescueTeam({
      id: "team-jump-1",
      districtId: homeDistrictId,
      organizationId: orgId,
      name: "Delta Team",
      capability: "GENERAL",
      status: "AVAILABLE",
    });

    // Cannot arrive directly from AVAILABLE
    expect(() => availableTeam.arrive()).toThrow(InvalidTransitionError);

    // Cannot start return directly from AVAILABLE
    expect(() => availableTeam.startReturn()).toThrow(InvalidTransitionError);

    // Cannot complete return when already AVAILABLE
    expect(() => availableTeam.completeReturn()).toThrow(InvalidTransitionError);

    const enRouteTeam = availableTeam.dispatch();
    // Cannot complete return directly from EN_ROUTE
    expect(() => enRouteTeam.completeReturn()).toThrow(InvalidTransitionError);
  });

  it("should preserve GPS coordinates and serialize properly via toJSON", () => {
    const team = new RescueTeam({
      id: "team-gps",
      districtId: homeDistrictId,
      organizationId: orgId,
      name: "Echo Team",
      capability: "AIR_RESCUE",
      status: "AVAILABLE",
      currentLatitude: 6.9271,
      currentLongitude: 79.8612,
    });

    expect(team.currentLatitude).toBe(6.9271);
    expect(team.currentLongitude).toBe(79.8612);

    const json = team.toJSON();
    expect(json.id).toBe("team-gps");
    expect(json.currentLatitude).toBe(6.9271);
    expect(json.status).toBe("AVAILABLE");
  });
});
