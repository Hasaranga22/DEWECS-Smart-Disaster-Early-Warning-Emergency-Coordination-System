import { InMemoryRepository } from "@/shared/infra/InMemoryRepository";
import { TeamStatusEvent, TeamStatusEventProps } from "../../domain/entities/TeamStatusEvent";
import { TeamStatusEventRepository } from "../repositories/TeamStatusEventRepository";

export class InMemoryTeamStatusEventRepository implements TeamStatusEventRepository {
  private readonly baseRepo = new InMemoryRepository<TeamStatusEventProps>("team_status_events");

  public async findById(id: string): Promise<TeamStatusEvent | null> {
    const props = await this.baseRepo.findById(id);
    return props ? new TeamStatusEvent(props) : null;
  }

  public async findByTeamId(teamId: string): Promise<TeamStatusEvent[]> {
    const all = await this.baseRepo.findAll();
    return all.filter((e) => e.teamId === teamId).map((props) => new TeamStatusEvent(props));
  }

  public async save(event: TeamStatusEvent): Promise<void> {
    await this.baseRepo.save({
      id: event.id,
      teamId: event.teamId,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      actorId: event.actorId,
      occurredAt: event.occurredAt,
      incident: event.incident,
      location: event.location,
    });
  }

  public clear(): void {
    this.baseRepo.clear();
  }

  public snapshot(): Map<string, TeamStatusEventProps> {
    return this.baseRepo.snapshot();
  }

  public restore(snap: Map<string, TeamStatusEventProps>): void {
    this.baseRepo.restore(snap);
  }
}
