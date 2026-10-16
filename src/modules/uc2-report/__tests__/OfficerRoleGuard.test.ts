import { describe, it, expect } from "vitest";
import { requireRole } from "@/shared/access/access";
import { AccessDeniedError } from "@/shared/access/errors";
import { DEMO_ACTORS } from "@/shared/access/actors";

describe("UC2 Officer Role Guard", () => {
  const allowedRoles = ["DUTY_OFFICER", "DMC_OFFICIAL"] as const;

  it("prevents CITIZEN from accessing the officer review console", () => {
    const citizenActor = DEMO_ACTORS.CITIZEN;

    expect(() => requireRole(citizenActor, allowedRoles)).toThrow(AccessDeniedError);
  });

  it("allows DUTY_OFFICER to access the officer review console", () => {
    const dutyOfficer = DEMO_ACTORS.DUTY_OFFICER;

    expect(() => requireRole(dutyOfficer, allowedRoles)).not.toThrow();
  });

  it("allows DMC_OFFICIAL to access the officer review console", () => {
    const dmcOfficial = DEMO_ACTORS.DMC_OFFICIAL;

    expect(() => requireRole(dmcOfficial, allowedRoles)).not.toThrow();
  });
});
