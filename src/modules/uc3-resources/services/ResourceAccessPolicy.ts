import { Actor } from "@/shared/contracts/types";
import { ForbiddenError } from "@/shared/infra/errors";

/**
 * Access policy enforcing role and district boundary rules for UC3 operations.
 * Rule: Only DISTRICT_OFFICER can manage resources, and only within their assigned district.
 */
export class ResourceAccessPolicy {
  public static assertDistrictOfficerAccess(actor: Actor, targetDistrictId: string): void {
    if (actor.role !== "DISTRICT_OFFICER") {
      throw new ForbiddenError(`Role '${actor.role}' is not authorized. Only DISTRICT_OFFICER can perform this action.`);
    }

    if (!actor.districtId || actor.districtId !== targetDistrictId) {
      throw new ForbiddenError(
        `Officer assigned to district '${actor.districtId ?? "none"}' cannot manage resources in district '${targetDistrictId}'.`
      );
    }
  }
}
