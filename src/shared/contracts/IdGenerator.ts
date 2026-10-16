/**
 * Contract for generating unique identifier strings in a deterministic, testable way.
 */
export interface IdGenerator {
  /** Generates the next unique identifier string. */
  next(): string;
}
