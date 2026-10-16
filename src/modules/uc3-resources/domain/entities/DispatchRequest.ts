export type DispatchRequestStatus = "UNASSIGNED" | "ASSIGNED" | "CANCELLED";

export interface DispatchRequestProps {
  id: string;
  districtId: string;
  incident?: string;
  location: string;
  requestedBy: string;
  status?: DispatchRequestStatus;
  teamId?: string;
  actionId: string;
  occurredAt: Date;
}

export class DispatchRequest {
  public readonly id: string;
  public readonly districtId: string;
  public readonly incident?: string;
  public readonly location: string;
  public readonly requestedBy: string;
  public readonly status: DispatchRequestStatus;
  public readonly teamId?: string;
  public readonly actionId: string;
  public readonly occurredAt: Date;

  constructor(props: DispatchRequestProps) {
    this.id = props.id;
    this.districtId = props.districtId;
    this.incident = props.incident;
    this.location = props.location;
    this.requestedBy = props.requestedBy;
    this.status = props.status ?? "UNASSIGNED";
    this.teamId = props.teamId;
    this.actionId = props.actionId;
    this.occurredAt = new Date(props.occurredAt);
  }

  public assign(teamId: string): DispatchRequest {
    return new DispatchRequest({
      ...this,
      teamId,
      status: "ASSIGNED",
    });
  }

  public cancel(): DispatchRequest {
    return new DispatchRequest({
      ...this,
      status: "CANCELLED",
    });
  }
}
