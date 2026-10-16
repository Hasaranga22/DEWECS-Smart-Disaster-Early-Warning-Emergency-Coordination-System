export type { IdGenerator } from "./IdGenerator";

/**
 * Contract for getting current system time in a deterministic, testable way.
 */
export interface Clock {
  /** Returns the current Date timestamp. */
  now(): Date;
}
