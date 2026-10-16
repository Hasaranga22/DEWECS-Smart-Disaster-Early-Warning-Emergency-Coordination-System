import { InMemoryRepository } from "@/shared/infra/InMemoryRepository";
import { OccupancyEvent, OccupancyEventProps } from "../../domain/entities/OccupancyEvent";
import { OccupancyEventRepository } from "../repositories/OccupancyEventRepository";
import { Filter } from "@/shared/contracts/types";

export class InMemoryOccupancyEventRepository implements OccupancyEventRepository {
  private readonly baseRepo = new InMemoryRepository<OccupancyEventProps>("occupancy_events");

  public async findById(id: string): Promise<OccupancyEvent | null> {
    const props = await this.baseRepo.findById(id);
    return props ? new OccupancyEvent(props) : null;
  }

  public async findByFilter(filter: Filter): Promise<OccupancyEvent[]> {
    let all = await this.baseRepo.findAll();

    if (filter.districtId) {
      all = all.filter((e) => e.districtId === filter.districtId);
    }
    if (filter.from) {
      all = all.filter((e) => new Date(e.occurredAt) >= filter.from!);
    }
    if (filter.to) {
      all = all.filter((e) => new Date(e.occurredAt) <= filter.to!);
    }
    if (filter.cutoff) {
      all = all.filter((e) => new Date(e.occurredAt) <= filter.cutoff!);
    }

    return all.map((props) => new OccupancyEvent(props));
  }

  public async save(event: OccupancyEvent): Promise<void> {
    await this.baseRepo.save({
      id: event.id,
      shelterId: event.shelterId,
      districtId: event.districtId,
      previousCount: event.previousCount,
      newCount: event.newCount,
      actorId: event.actorId,
      occurredAt: event.occurredAt,
      actionId: event.actionId,
    });
  }

  public clear(): void {
    this.baseRepo.clear();
  }

  public snapshot(): Map<string, OccupancyEventProps> {
    return this.baseRepo.snapshot();
  }

  public restore(snap: Map<string, OccupancyEventProps>): void {
    this.baseRepo.restore(snap);
  }
}
