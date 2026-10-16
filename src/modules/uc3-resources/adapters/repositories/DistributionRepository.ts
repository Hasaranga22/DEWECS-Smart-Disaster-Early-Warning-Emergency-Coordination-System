import { Distribution } from "../../domain/entities/Distribution";
import { Filter } from "@/shared/contracts/types";

export interface DistributionRepository {
  findById(id: string): Promise<Distribution | null>;
  findByFilter(filter: Filter): Promise<Distribution[]>;
  save(distribution: Distribution): Promise<void>;
}
