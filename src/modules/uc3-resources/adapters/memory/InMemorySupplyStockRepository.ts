import { InMemoryRepository } from "@/shared/infra/InMemoryRepository";
import { SupplyStock, SupplyStockProps } from "../../domain/entities/SupplyStock";
import { SupplyStockRepository } from "../repositories/SupplyStockRepository";

export class InMemorySupplyStockRepository implements SupplyStockRepository {
  private readonly baseRepo = new InMemoryRepository<SupplyStockProps>("supply_stocks");

  public async findById(id: string): Promise<SupplyStock | null> {
    const props = await this.baseRepo.findById(id);
    return props ? new SupplyStock(props) : null;
  }

  public async findByDistrictId(districtId: string): Promise<SupplyStock[]> {
    const all = await this.baseRepo.findAll();
    return all.filter((s) => s.districtId === districtId).map((props) => new SupplyStock(props));
  }

  public async findAll(): Promise<SupplyStock[]> {
    const all = await this.baseRepo.findAll();
    return all.map((props) => new SupplyStock(props));
  }

  public async save(stock: SupplyStock): Promise<void> {
    await this.baseRepo.save({
      id: stock.id,
      organizationId: stock.organizationId,
      districtId: stock.districtId,
      supplyType: stock.supplyType,
      onHand: stock.onHand,
      version: stock.version,
    });
  }

  public clear(): void {
    this.baseRepo.clear();
  }

  public snapshot(): Map<string, SupplyStockProps> {
    return this.baseRepo.snapshot();
  }

  public restore(snap: Map<string, SupplyStockProps>): void {
    this.baseRepo.restore(snap);
  }
}
