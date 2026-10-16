export interface OccupancyEventProps {
  id: string;
  shelterId: string;
  districtId: string;
  previousCount: number;
  newCount: number;
  actorId: string;
  occurredAt: Date;
  actionId: string;
}

export class OccupancyEvent {
  public readonly id: string;
  public readonly shelterId: string;
  public readonly districtId: string;
  public readonly previousCount: number;
  public readonly newCount: number;
  public readonly actorId: string;
  public readonly occurredAt: Date;
  public readonly actionId: string;

  constructor(props: OccupancyEventProps) {
    this.id = props.id;
    this.shelterId = props.shelterId;
    this.districtId = props.districtId;
    this.previousCount = props.previousCount;
    this.newCount = props.newCount;
    this.actorId = props.actorId;
    this.occurredAt = new Date(props.occurredAt);
    this.actionId = props.actionId;
  }
}
