import type { DistributionReader, Distribution, Filter } from '@/shared/contracts/types'

export class InMemoryDistributionReader implements DistributionReader {
  private data: Distribution[] = []

  async listDistributions(_filter: Filter): Promise<Distribution[]> {
    return this.data
  }

  seed(rows: Distribution[]) {
    this.data = rows
  }

  clear() {
    this.data = []
  }

  add(distribution: Distribution) {
    this.data.push(distribution)
  }
}
