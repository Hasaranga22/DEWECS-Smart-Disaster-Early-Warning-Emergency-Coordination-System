import { InvalidQuantityError } from "../errors";

/**
 * Value object representing supply distribution quantity.
 * Invariant: strictly positive integer (> 0).
 */
export class Quantity {
  public readonly value: number;

  constructor(value: number) {
    if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
      throw new InvalidQuantityError(`Quantity must be a positive integer (> 0), got ${value}`);
    }
    this.value = value;
  }
}
