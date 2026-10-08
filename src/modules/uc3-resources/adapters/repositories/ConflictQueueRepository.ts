import { ConflictQueueItem } from "../../domain/entities/ConflictQueueItem";

export interface ConflictQueueRepository {
  findById(id: string): Promise<ConflictQueueItem | null>;
  findOpenByDistrictId(districtId: string): Promise<ConflictQueueItem[]>;
  save(item: ConflictQueueItem): Promise<void>;
}
