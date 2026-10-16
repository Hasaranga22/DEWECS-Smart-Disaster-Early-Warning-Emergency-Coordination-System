import { SupplyStock } from "../../domain/entities/SupplyStock";

export interface SupplyStockRepository {
  findById(id: string): Promise<SupplyStock | null>;
  findByDistrictId(districtId: string): Promise<SupplyStock[]>;
  findAll(): Promise<SupplyStock[]>;
  save(stock: SupplyStock): Promise<void>;
}
