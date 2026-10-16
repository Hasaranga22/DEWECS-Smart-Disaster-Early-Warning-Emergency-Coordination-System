import { RescueTeamStatus } from "../states/TeamState";

export interface TeamStatusEventProps {
  id: string;
  teamId: string;
  fromStatus: RescueTeamStatus;
  toStatus: RescueTeamStatus;
  actorId: string;
  occurredAt: Date;
  incident?: string;
  location?: string;
}

export class TeamStatusEvent {
  public readonly id: string;
  public readonly teamId: string;
  public readonly fromStatus: RescueTeamStatus;
  public readonly toStatus: RescueTeamStatus;
  public readonly actorId: string;
  public readonly occurredAt: Date;
  public readonly incident?: string;
  public readonly location?: string;

  constructor(props: TeamStatusEventProps) {
    this.id = props.id;
    this.teamId = props.teamId;
    this.fromStatus = props.fromStatus;
    this.toStatus = props.toStatus;
    this.actorId = props.actorId;
    this.occurredAt = new Date(props.occurredAt);
    this.incident = props.incident;
    this.location = props.location;
  }
}
