import type { Clock } from '@/shared/contracts/types'

export class FakeClock implements Clock {
  constructor(private fixed: Date) {}

  now(): Date {
    return this.fixed
  }

  advance(ms: number): void {
    this.fixed = new Date(this.fixed.getTime() + ms)
  }
}
