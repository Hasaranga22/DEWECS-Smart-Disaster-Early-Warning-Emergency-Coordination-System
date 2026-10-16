import { IdGenerator } from "../../contracts/IdGenerator";

/**
 * Sequential UUID generator for testing.
 * Generates valid UUID-v4 formatted strings incrementally.
 * e.g., "00000000-0000-4000-8000-000000000001"
 */
export class SequentialIdGenerator implements IdGenerator {
  private counter = 0;

  constructor(_prefix = "") {
    // prefix retained for call-site compatibility; IDs stay UUID-shaped for tests
  }

  public next(): string {
    this.counter += 1;
    const hex = this.counter.toString(16).padStart(12, "0");
    return `00000000-0000-4000-8000-${hex}`;
  }

  public reset(): void {
    this.counter = 0;
  }
}
