import { RescueTeam } from "../../domain/entities/RescueTeam";

export interface RescueTeamRepository {
  findById(id: string): Promise<RescueTeam | null>;
  findByDistrictId(districtId: string): Promise<RescueTeam[]>;
  findAll(): Promise<RescueTeam[]>;
  save(team: RescueTeam): Promise<void>;
}
