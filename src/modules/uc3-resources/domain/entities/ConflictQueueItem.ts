export type ConflictStatus = "OPEN" | "RESOLVED";

export interface ConflictQueueItemProps {
  id: string;
  actionType: string;
  payload: Record<string, unknown>;
  expectedVersion: number;
  actualVersion: number;
  status?: ConflictStatus;
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export class ConflictQueueItem {
  public readonly id: string;
  public readonly actionType: string;
  public readonly payload: Record<string, unknown>;
  public readonly expectedVersion: number;
  public readonly actualVersion: number;
  public readonly status: ConflictStatus;
  public readonly createdAt: Date;
  public readonly resolvedAt?: Date;
  public readonly resolvedBy?: string;

  constructor(props: ConflictQueueItemProps) {
    this.id = props.id;
    this.actionType = props.actionType;
    this.payload = props.payload;
    this.expectedVersion = props.expectedVersion;
    this.actualVersion = props.actualVersion;
    this.status = props.status ?? "OPEN";
    this.createdAt = new Date(props.createdAt);
    this.resolvedAt = props.resolvedAt ? new Date(props.resolvedAt) : undefined;
    this.resolvedBy = props.resolvedBy;
  }

  public get districtId(): string | undefined {
    return typeof this.payload.districtId === "string" ? this.payload.districtId : undefined;
  }

  public resolve(officerId: string, resolvedAt: Date): ConflictQueueItem {
    return new ConflictQueueItem({
      ...this,
      status: "RESOLVED",
      resolvedBy: officerId,
      resolvedAt,
    });
  }
}
