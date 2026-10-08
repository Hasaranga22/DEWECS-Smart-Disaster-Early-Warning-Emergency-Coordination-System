import { OccupancyEvent } from "../../domain/entities/OccupancyEvent";
import { Filter } from "@/shared/contracts/types";

export interface OccupancyEventRepository {
  findById(id: string): Promise<OccupancyEvent | null>;
  findByFilter(filter: Filter): Promise<OccupancyEvent[]>;
  save(event: OccupancyEvent): Promise<void>;
}
