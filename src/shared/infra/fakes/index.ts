import type { Clock, IdGenerator } from '@/shared/contracts/Clock'

/**
 * FakeClock — deterministic Clock for tests (README §4: shared/infra/fakes).
 *
 * Never call `new Date()` in services; inject this instead so tests control
 * time. `now()` returns a defensive copy so callers cannot mutate the
 * clock's internal state.
 */
export class FakeClock implements Clock {
  private current: Date

  constructor(initial: Date = new Date('2026-01-01T00:00:00.000Z')) {
    this.current = new Date(initial.getTime())
  }

  now(): Date {
    return new Date(this.current.getTime())
  }

  set(time: Date): void {
    this.current = new Date(time.getTime())
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms)
  }
}

/**
 * SequentialIdGenerator — predictable ids for tests: report-1, report-2, ...
 */
export class SequentialIdGenerator implements IdGenerator {
  private counter = 0

  next(): string {
    this.counter += 1
    return `report-${this.counter}`
  }
}
