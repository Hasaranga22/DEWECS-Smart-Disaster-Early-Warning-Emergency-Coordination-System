import { Clock } from "../../contracts/Clock";

/**
 * Controllable FakeClock implementation for deterministic unit testing.
 */
export class FakeClock implements Clock {
  private current: Date;

  constructor(initialDate: Date = new Date("2026-10-08T10:00:00.000Z")) {
    this.current = new Date(initialDate);
  }

  public now(): Date {
    return new Date(this.current);
  }

  public set(date: Date): void {
    this.current = new Date(date);
  }

  public advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
