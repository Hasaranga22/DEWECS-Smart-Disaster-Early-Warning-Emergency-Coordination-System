import { Actor } from "@/shared/contracts/types";
import { ForbiddenError } from "@/shared/infra/errors";

/**
 * Access policy enforcing role and district boundary rules for UC3 operations.
 * Allows DISTRICT_OFFICER, DMC_OFFICIAL, and DUTY_OFFICER.
 */
export class ResourceAccessPolicy {
  public static assertDistrictOfficerAccess(actor: Actor, targetDistrictId: string): void {
    const allowedRoles: string[] = ["DISTRICT_OFFICER", "DMC_OFFICIAL", "DUTY_OFFICER"];
    if (!allowedRoles.includes(actor.role)) {
      throw new ForbiddenError(`Role '${actor.role}' is not authorized. Only official roles can perform this action.`);
    }

    // Only enforce district boundary restrictions for DISTRICT_OFFICER (DMC_OFFICIAL & DUTY_OFFICER have national scope)
    if (actor.role === "DISTRICT_OFFICER" && actor.districtId && actor.districtId !== targetDistrictId) {
      throw new ForbiddenError(
        `Officer assigned to district '${actor.districtId}' cannot manage resources in district '${targetDistrictId}'.`
      );
    }
  }
}
