import { ConflictQueueItem } from "../domain/entities/ConflictQueueItem";
import { ConflictQueueRepository } from "../adapters/repositories/ConflictQueueRepository";
import { Clock } from "@/shared/contracts/Clock";
import { IdGenerator } from "@/shared/contracts/IdGenerator";
import { NotFoundError } from "@/shared/infra/errors";

export class ConflictQueue {
  constructor(
    private readonly repo: ConflictQueueRepository,
    private readonly clock: Clock,
    private readonly idGen: IdGenerator
  ) {}

  public async enqueue(
    actionType: string,
    payload: Record<string, unknown>,
    expectedVersion: number,
    actualVersion: number
  ): Promise<ConflictQueueItem> {
    const item = new ConflictQueueItem({
      id: this.idGen.next(),
      actionType,
      payload,
      expectedVersion,
      actualVersion,
      status: "OPEN",
      createdAt: this.clock.now(),
    });
    await this.repo.save(item);
    return item;
  }

  public async listOpen(districtId: string): Promise<ConflictQueueItem[]> {
    return this.repo.findOpenByDistrictId(districtId);
  }

  public async resolve(id: string, resolution: "RETRY" | "DISCARD", officerId: string): Promise<ConflictQueueItem> {
    const item = await this.repo.findById(id);
    if (!item) {
      throw new NotFoundError(`Conflict item '${id}' not found`);
    }

    const resolvedItem = item.resolve(officerId, this.clock.now());
    await this.repo.save(resolvedItem);
    return resolvedItem;
  }
}
