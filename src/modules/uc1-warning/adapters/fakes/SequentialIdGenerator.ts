import type { IdGenerator } from '../../ports/IdGenerator';

export class SequentialIdGenerator implements IdGenerator {
  private counter = 0;
  private prefix: string;

  constructor(prefix: string = 'id') {
    this.prefix = prefix;
  }

  public next(): string {
    this.counter += 1;
    return `${this.prefix}-${this.counter.toString().padStart(4, '0')}`;
  }

  public reset(): void {
    this.counter = 0;
  }
}
