import type { SupplyStockReader, SupplyStock, Filter } from '@/shared/contracts/types'

/**
 * InMemorySupplyStockReader
 *
 * Responsibility: in-memory SupplyStockReader used when DATA_STORE=memory
 * and by tests (no real DB, no Prisma imports).
 */
export class InMemorySupplyStockReader implements SupplyStockReader {
  private readonly stocks: SupplyStock[] = []

  addStock(stock: SupplyStock): void {
    this.stocks.push(stock)
  }

  clear(): void {
    this.stocks.length = 0
  }

  async listStocks(f: Filter): Promise<SupplyStock[]> {
    let result = this.stocks
    if (f.districtId) {
      result = result.filter(s => s.districtId === f.districtId)
    }
    return result
  }
}
