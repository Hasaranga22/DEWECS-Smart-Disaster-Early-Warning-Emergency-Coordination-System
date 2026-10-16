import { InvalidQuantityError } from "../errors";

/**
 * Value object representing shelter occupancy count.
 * Invariant: non-negative integer.
 */
export class OccupancyCount {
  public readonly value: number;

  constructor(value: number) {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
      throw new InvalidQuantityError(`Occupancy count must be a non-negative integer, got ${value}`);
    }
    this.value = value;
  }
}
