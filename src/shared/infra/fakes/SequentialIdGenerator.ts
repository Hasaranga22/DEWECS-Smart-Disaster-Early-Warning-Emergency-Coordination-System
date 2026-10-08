import type { IdGenerator } from '@/shared/contracts/types'

export class SequentialIdGenerator implements IdGenerator {
  private counter = 0

  constructor(private prefix = 'id') {}

  next(): string {
    return `${this.prefix}-${++this.counter}`
  }
}
