import { InMemoryRepository } from "@/shared/infra/InMemoryRepository";
import { DispatchRequest, DispatchRequestProps } from "../../domain/entities/DispatchRequest";
import { DispatchRequestRepository } from "../repositories/DispatchRequestRepository";

export class InMemoryDispatchRequestRepository implements DispatchRequestRepository {
  private readonly baseRepo = new InMemoryRepository<DispatchRequestProps>("dispatch_requests");

  public async findById(id: string): Promise<DispatchRequest | null> {
    const props = await this.baseRepo.findById(id);
    return props ? new DispatchRequest(props) : null;
  }

  public async findUnassignedByDistrictId(districtId: string): Promise<DispatchRequest[]> {
    const all = await this.baseRepo.findAll();
    return all
      .filter((r) => r.districtId === districtId && (r.status ?? "UNASSIGNED") === "UNASSIGNED")
      .map((props) => new DispatchRequest(props));
  }

  public async save(request: DispatchRequest): Promise<void> {
    await this.baseRepo.save({
      id: request.id,
      districtId: request.districtId,
      incident: request.incident,
      location: request.location,
      requestedBy: request.requestedBy,
      status: request.status,
      teamId: request.teamId,
      actionId: request.actionId,
      occurredAt: request.occurredAt,
    });
  }

  public clear(): void {
    this.baseRepo.clear();
  }

  public snapshot(): Map<string, DispatchRequestProps> {
    return this.baseRepo.snapshot();
  }

  public restore(snap: Map<string, DispatchRequestProps>): void {
    this.baseRepo.restore(snap);
  }
}
