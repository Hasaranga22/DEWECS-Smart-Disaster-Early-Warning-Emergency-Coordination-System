import { InMemoryRepository } from "@/shared/infra/InMemoryRepository";
import { ConflictQueueItem, ConflictQueueItemProps } from "../../domain/entities/ConflictQueueItem";
import { ConflictQueueRepository } from "../repositories/ConflictQueueRepository";

export class InMemoryConflictQueueRepository implements ConflictQueueRepository {
  private readonly baseRepo = new InMemoryRepository<ConflictQueueItemProps>("conflict_queue_items");

  public async findById(id: string): Promise<ConflictQueueItem | null> {
    const props = await this.baseRepo.findById(id);
    return props ? new ConflictQueueItem(props) : null;
  }

  public async findOpenByDistrictId(districtId: string): Promise<ConflictQueueItem[]> {
    const all = await this.baseRepo.findAll();
    return all
      .map((props) => new ConflictQueueItem(props))
      .filter((item) => item.status === "OPEN" && item.districtId === districtId);
  }

  public async save(item: ConflictQueueItem): Promise<void> {
    await this.baseRepo.save({
      id: item.id,
      actionType: item.actionType,
      payload: item.payload,
      expectedVersion: item.expectedVersion,
      actualVersion: item.actualVersion,
      status: item.status,
      createdAt: item.createdAt,
      resolvedAt: item.resolvedAt,
      resolvedBy: item.resolvedBy,
    });
  }

  public clear(): void {
    this.baseRepo.clear();
  }

  public snapshot(): Map<string, ConflictQueueItemProps> {
    return this.baseRepo.snapshot();
  }

  public restore(snap: Map<string, ConflictQueueItemProps>): void {
    this.baseRepo.restore(snap);
  }
}
