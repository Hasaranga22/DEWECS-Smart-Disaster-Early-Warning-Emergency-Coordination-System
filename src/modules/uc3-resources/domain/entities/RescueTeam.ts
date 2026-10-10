import { TeamNotAvailableError } from "../errors";
import { TeamState, parseTeamState, RescueTeamStatus } from "../states/TeamState";

export interface RescueTeamProps {
  id: string;
  districtId: string; // Home district ID - NEVER changes
  organizationId: string;
  name: string;
  capability: string;
  status?: RescueTeamStatus;
  state?: TeamState;
  version?: number;
  currentLatitude?: number;
  currentLongitude?: number;
}

export class RescueTeam {
  public readonly id: string;
  public readonly districtId: string;
  public readonly organizationId: string;
  public readonly name: string;
  public readonly capability: string;
  public readonly state: TeamState;
  public readonly version: number;
  public readonly currentLatitude?: number;
  public readonly currentLongitude?: number;

  constructor(props: RescueTeamProps) {
    this.id = props.id;
    this.districtId = props.districtId;
    this.organizationId = props.organizationId;
    this.name = props.name;
    this.capability = props.capability;
    this.state = props.state ?? parseTeamState(props.status ?? "AVAILABLE");
    this.version = props.version ?? 0;
    this.currentLatitude = props.currentLatitude;
    this.currentLongitude = props.currentLongitude;
  }

  public get status(): RescueTeamStatus {
    return this.state.name;
  }

  public dispatch(): RescueTeam {
    if (this.status !== "AVAILABLE") {
      throw new TeamNotAvailableError(`Team '${this.name}' is currently in state ${this.status}, cannot dispatch`);
    }
    return new RescueTeam({
      ...this,
      state: this.state.dispatch(),
      version: this.version + 1,
    });
  }

  public arrive(): RescueTeam {
    return new RescueTeam({
      ...this,
      state: this.state.arrive(),
      version: this.version + 1,
    });
  }

  public startReturn(): RescueTeam {
    return new RescueTeam({
      ...this,
      state: this.state.startReturn(),
      version: this.version + 1,
    });
  }

  public completeReturn(): RescueTeam {
    return new RescueTeam({
      ...this,
      state: this.state.completeReturn(),
    });
  }

  public toJSON() {

    return {
      id: this.id,
      districtId: this.districtId,
      organizationId: this.organizationId,
      name: this.name,
      capability: this.capability,
      status: this.status,
      version: this.version,
      currentLatitude: this.currentLatitude,
      currentLongitude: this.currentLongitude,
    };
  }
}

