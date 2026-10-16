import { InvalidTransitionError } from "../errors";

export type RescueTeamStatus = "AVAILABLE" | "EN_ROUTE" | "ON_SITE" | "RETURNING";

/**
 * State interface for RescueTeam state machine.
 */
export interface TeamState {
  readonly name: RescueTeamStatus;
  dispatch(): TeamState;
  arrive(): TeamState;
  startReturn(): TeamState;
  completeReturn(): TeamState;
}

export class AvailableState implements TeamState {
  public readonly name: RescueTeamStatus = "AVAILABLE";

  public dispatch(): TeamState {
    return new EnRouteState();
  }
  public arrive(): TeamState {
    throw new InvalidTransitionError(this.name, "ON_SITE");
  }
  public startReturn(): TeamState {
    throw new InvalidTransitionError(this.name, "RETURNING");
  }
  public completeReturn(): TeamState {
    throw new InvalidTransitionError(this.name, "AVAILABLE");
  }
}

export class EnRouteState implements TeamState {
  public readonly name: RescueTeamStatus = "EN_ROUTE";

  public dispatch(): TeamState {
    throw new InvalidTransitionError(this.name, "EN_ROUTE");
  }
  public arrive(): TeamState {
    return new OnSiteState();
  }
  public startReturn(): TeamState {
    throw new InvalidTransitionError(this.name, "RETURNING");
  }
  public completeReturn(): TeamState {
    throw new InvalidTransitionError(this.name, "AVAILABLE");
  }
}

export class OnSiteState implements TeamState {
  public readonly name: RescueTeamStatus = "ON_SITE";

  public dispatch(): TeamState {
    throw new InvalidTransitionError(this.name, "EN_ROUTE");
  }
  public arrive(): TeamState {
    throw new InvalidTransitionError(this.name, "ON_SITE");
  }
  public startReturn(): TeamState {
    return new ReturningState();
  }
  public completeReturn(): TeamState {
    throw new InvalidTransitionError(this.name, "AVAILABLE");
  }
}

export class ReturningState implements TeamState {
  public readonly name: RescueTeamStatus = "RETURNING";

  public dispatch(): TeamState {
    throw new InvalidTransitionError(this.name, "EN_ROUTE");
  }
  public arrive(): TeamState {
    throw new InvalidTransitionError(this.name, "ON_SITE");
  }
  public startReturn(): TeamState {
    throw new InvalidTransitionError(this.name, "RETURNING");
  }
  public completeReturn(): TeamState {
    return new AvailableState();
  }
}

export function parseTeamState(status: RescueTeamStatus): TeamState {
  switch (status) {
    case "AVAILABLE":
      return new AvailableState();
    case "EN_ROUTE":
      return new EnRouteState();
    case "ON_SITE":
      return new OnSiteState();
    case "RETURNING":
      return new ReturningState();
    default:
      return new AvailableState();
  }
}
