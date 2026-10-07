/**
 * Shared infrastructure interfaces for clocks and ID generation.
 *
 *   Never call `new Date()`, `Date.now()`, or `crypto.randomUUID()`
 *   directly inside a service or domain class.
 *   Always use Clock and IdGenerator so tests remain deterministic.
 */

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(): string;
}
