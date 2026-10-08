import { RescueTeam } from "../../domain/entities/RescueTeam";
import {
  CrossOrganizationConfirmationRequiredError,
  CrossDistrictConfirmationRequiredError,
} from "../../domain/errors";

export interface DispatchRule {
  validate(team: RescueTeam, destinationDistrictId: string, isConfirmed?: boolean): void;
}

/**
 * Validates that dispatching a partner organization team (non-GOVERNMENT) has explicit confirmation.
 */
export class CrossOrganizationRule implements DispatchRule {
  constructor(private readonly governmentOrganizationId?: string) {}

  public validate(team: RescueTeam, _destinationDistrictId: string, isConfirmed?: boolean): void {
    const orgId = team.organizationId.toLowerCase();
    const isGovernment = this.governmentOrganizationId
      ? team.organizationId === this.governmentOrganizationId
      : orgId.includes("gov") || orgId.includes("government") || orgId.endsWith("100");

    if (!isGovernment && !isConfirmed) {
      throw new CrossOrganizationConfirmationRequiredError(
        `Team '${team.name}' belongs to partner organization '${team.organizationId}'. Confirmation required.`
      );
    }
  }
}

/**
 * Validates that cross-district backup dispatch has explicit confirmation.
 */
export class CrossDistrictRule implements DispatchRule {
  public validate(team: RescueTeam, destinationDistrictId: string, isConfirmed?: boolean): void {
    if (team.districtId !== destinationDistrictId && !isConfirmed) {
      throw new CrossDistrictConfirmationRequiredError(
        `Team '${team.name}' home district is '${team.districtId}', dispatch destination is '${destinationDistrictId}'. Cross-district confirmation required.`
      );
    }
  }
}
