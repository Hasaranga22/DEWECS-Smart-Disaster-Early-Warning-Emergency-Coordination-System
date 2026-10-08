import { TeamStatusEvent } from "../../domain/entities/TeamStatusEvent";

export interface TeamStatusEventRepository {
  findById(id: string): Promise<TeamStatusEvent | null>;
  findByTeamId(teamId: string): Promise<TeamStatusEvent[]>;
  save(event: TeamStatusEvent): Promise<void>;
}
