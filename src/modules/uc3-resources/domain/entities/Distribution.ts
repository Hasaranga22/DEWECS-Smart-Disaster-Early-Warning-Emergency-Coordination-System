export interface DistributionProps {
  id: string;
  stockId: string;
  destinationShelterId: string;
  organizationId: string;
  districtId: string;
  quantity: number;
  actorId: string;
  occurredAt: Date;
  actionId: string;
}

export class Distribution {
  public readonly id: string;
  public readonly stockId: string;
  public readonly destinationShelterId: string;
  public readonly organizationId: string;
  public readonly districtId: string;
  public readonly quantity: number;
  public readonly actorId: string;
  public readonly occurredAt: Date;
  public readonly actionId: string;

  constructor(props: DistributionProps) {
    this.id = props.id;
    this.stockId = props.stockId;
    this.destinationShelterId = props.destinationShelterId;
    this.organizationId = props.organizationId;
    this.districtId = props.districtId;
    this.quantity = props.quantity;
    this.actorId = props.actorId;
    this.occurredAt = new Date(props.occurredAt);
    this.actionId = props.actionId;
  }
}
