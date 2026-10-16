import { InsufficientStockError } from "../errors";
import { Quantity } from "../valueObjects/Quantity";

export interface SupplyStockProps {
  id: string;
  organizationId: string;
  districtId: string;
  supplyType: string;
  onHand: number;
  version?: number;
}

export class SupplyStock {
  public readonly id: string;
  public readonly organizationId: string;
  public readonly districtId: string;
  public readonly supplyType: string;
  public readonly onHand: number;
  public readonly version: number;

  constructor(props: SupplyStockProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.districtId = props.districtId;
    this.supplyType = props.supplyType;
    this.onHand = Math.max(0, props.onHand);
    this.version = props.version ?? 0;
  }

  public withDeduction(quantityInput: number): SupplyStock {
    const qty = new Quantity(quantityInput).value;
    if (this.onHand < qty) {
      throw new InsufficientStockError(
        `Insufficient stock for '${this.supplyType}': requested ${qty}, available ${this.onHand}`
      );
    }

    return new SupplyStock({
      id: this.id,
      organizationId: this.organizationId,
      districtId: this.districtId,
      supplyType: this.supplyType,
      onHand: this.onHand - qty,
      version: this.version + 1,
    });
  }
}
