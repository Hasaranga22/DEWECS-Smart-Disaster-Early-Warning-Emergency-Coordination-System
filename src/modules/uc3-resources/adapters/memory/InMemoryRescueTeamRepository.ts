import { InMemoryRepository } from "@/shared/infra/InMemoryRepository";
import { RescueTeam, RescueTeamProps } from "../../domain/entities/RescueTeam";
import { RescueTeamRepository } from "../repositories/RescueTeamRepository";
import { RescueTeamStatus } from "../../domain/states/TeamState";

interface StoredTeamProps extends Omit<RescueTeamProps, "state"> {
  status: RescueTeamStatus;
}

export class InMemoryRescueTeamRepository implements RescueTeamRepository {
  private readonly baseRepo = new InMemoryRepository<StoredTeamProps>("rescue_teams");

  public async findById(id: string): Promise<RescueTeam | null> {
    const props = await this.baseRepo.findById(id);
    return props ? new RescueTeam(props) : null;
  }

  public async findByDistrictId(districtId: string): Promise<RescueTeam[]> {
    const all = await this.baseRepo.findAll();
    return all.filter((t) => t.districtId === districtId).map((props) => new RescueTeam(props));
  }

  public async findAll(): Promise<RescueTeam[]> {
    const all = await this.baseRepo.findAll();
    return all.map((props) => new RescueTeam(props));
  }

  public async save(team: RescueTeam): Promise<void> {
    await this.baseRepo.save({
      id: team.id,
      districtId: team.districtId,
      organizationId: team.organizationId,
      name: team.name,
      capability: team.capability,
      status: team.status,
      version: team.version,
      currentLatitude: team.currentLatitude,
      currentLongitude: team.currentLongitude,
    });
  }

  public clear(): void {
    this.baseRepo.clear();
  }

  public snapshot(): Map<string, StoredTeamProps> {
    return this.baseRepo.snapshot();
  }

  public restore(snap: Map<string, StoredTeamProps>): void {
    this.baseRepo.restore(snap);
  }
}
