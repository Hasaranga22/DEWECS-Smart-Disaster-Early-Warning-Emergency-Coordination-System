import type { OccupancyEventReader, OccupancyEvent, Filter } from '@/shared/contracts/types'

export class InMemoryOccupancyEventReader implements OccupancyEventReader {
  private data: OccupancyEvent[] = []

  async listEvents(_filter: Filter): Promise<OccupancyEvent[]> {
    return this.data
  }

  seed(rows: OccupancyEvent[]) {
    this.data = rows
  }

  clear() {
    this.data = []
  }

  add(event: OccupancyEvent) {
    this.data.push(event)
  }
}
