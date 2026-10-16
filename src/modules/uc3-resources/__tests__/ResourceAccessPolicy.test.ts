import { describe, it, expect } from "vitest";
import { ResourceAccessPolicy } from "../services/ResourceAccessPolicy";
import { Actor } from "@/shared/contracts/types";
import { ForbiddenError } from "@/shared/infra/errors";

describe("ResourceAccessPolicy", () => {
  const colomboDistrictId = "00000000-0000-4000-8000-000000000010";
  const gampahaDistrictId = "00000000-0000-4000-8000-000000000020";

  it("should permit DISTRICT_OFFICER within their assigned district", () => {
    const actor: Actor = {
      id: "officer-colombo-1",
      role: "DISTRICT_OFFICER",
      districtId: colomboDistrictId,
    };

    expect(() =>
      ResourceAccessPolicy.assertDistrictOfficerAccess(actor, colomboDistrictId)
    ).not.toThrow();
  });

  it("should reject DISTRICT_OFFICER attempting to manage another district", () => {
    const actor: Actor = {
      id: "officer-colombo-1",
      role: "DISTRICT_OFFICER",
      districtId: colomboDistrictId,
    };

    expect(() =>
      ResourceAccessPolicy.assertDistrictOfficerAccess(actor, gampahaDistrictId)
    ).toThrow(ForbiddenError);
  });

  it("should permit DMC_OFFICIAL across any district (national scope)", () => {
    const dmcActor: Actor = {
      id: "dmc-official-1",
      role: "DMC_OFFICIAL",
    };

    expect(() =>
      ResourceAccessPolicy.assertDistrictOfficerAccess(dmcActor, colomboDistrictId)
    ).not.toThrow();
    expect(() =>
      ResourceAccessPolicy.assertDistrictOfficerAccess(dmcActor, gampahaDistrictId)
    ).not.toThrow();
  });

  it("should permit DUTY_OFFICER across any district", () => {
    const dutyActor: Actor = {
      id: "duty-officer-1",
      role: "DUTY_OFFICER",
    };

    expect(() =>
      ResourceAccessPolicy.assertDistrictOfficerAccess(dutyActor, colomboDistrictId)
    ).not.toThrow();
  });

  it("should reject CITIZEN actors with ForbiddenError", () => {
    const citizenActor: Actor = {
      id: "citizen-1",
      role: "CITIZEN",
    };

    expect(() =>
      ResourceAccessPolicy.assertDistrictOfficerAccess(citizenActor, colomboDistrictId)
    ).toThrow(ForbiddenError);
  });
});
