import { InMemoryRepository } from "@/shared/infra/InMemoryRepository";
import { Distribution, DistributionProps } from "../../domain/entities/Distribution";
import { DistributionRepository } from "../repositories/DistributionRepository";
import { Filter } from "@/shared/contracts/types";

export class InMemoryDistributionRepository implements DistributionRepository {
  private readonly baseRepo = new InMemoryRepository<DistributionProps>("distributions");

  public async findById(id: string): Promise<Distribution | null> {
    const props = await this.baseRepo.findById(id);
    return props ? new Distribution(props) : null;
  }

  public async findByFilter(filter: Filter): Promise<Distribution[]> {
    let all = await this.baseRepo.findAll();

    if (filter.districtId) {
      all = all.filter((d) => d.districtId === filter.districtId);
    }
    if (filter.from) {
      all = all.filter((d) => new Date(d.occurredAt) >= filter.from!);
    }
    if (filter.to) {
      all = all.filter((d) => new Date(d.occurredAt) <= filter.to!);
    }
    if (filter.cutoff) {
      all = all.filter((d) => new Date(d.occurredAt) <= filter.cutoff!);
    }

    return all.map((props) => new Distribution(props));
  }

  public async save(distribution: Distribution): Promise<void> {
    await this.baseRepo.save({
      id: distribution.id,
      stockId: distribution.stockId,
      destinationShelterId: distribution.destinationShelterId,
      organizationId: distribution.organizationId,
      districtId: distribution.districtId,
      quantity: distribution.quantity,
      actorId: distribution.actorId,
      occurredAt: distribution.occurredAt,
      actionId: distribution.actionId,
    });
  }

  public clear(): void {
    this.baseRepo.clear();
  }

  public snapshot(): Map<string, DistributionProps> {
    return this.baseRepo.snapshot();
  }

  public restore(snap: Map<string, DistributionProps>): void {
    this.baseRepo.restore(snap);
  }
}
