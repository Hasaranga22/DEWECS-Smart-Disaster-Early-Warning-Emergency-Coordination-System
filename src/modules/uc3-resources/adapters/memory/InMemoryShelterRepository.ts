import { InMemoryRepository } from "@/shared/infra/InMemoryRepository";
import { Shelter, ShelterProps } from "../../domain/entities/Shelter";
import { ShelterRepository } from "../repositories/ShelterRepository";

export class InMemoryShelterRepository implements ShelterRepository {
  private readonly baseRepo = new InMemoryRepository<ShelterProps>("shelters");

  public async findById(id: string): Promise<Shelter | null> {
    const props = await this.baseRepo.findById(id);
    return props ? new Shelter(props) : null;
  }

  public async findByDistrictId(districtId: string): Promise<Shelter[]> {
    const all = await this.baseRepo.findAll();
    return all.filter((s) => s.districtId === districtId).map((props) => new Shelter(props));
  }

  public async findAll(): Promise<Shelter[]> {
    const all = await this.baseRepo.findAll();
    return all.map((props) => new Shelter(props));
  }

  public async save(shelter: Shelter): Promise<void> {
    await this.baseRepo.save({
      id: shelter.id,
      districtId: shelter.districtId,
      organizationId: shelter.organizationId,
      name: shelter.name,
      address: shelter.address,
      latitude: shelter.latitude,
      longitude: shelter.longitude,
      capacity: shelter.capacity,
      occupancy: shelter.occupancy,
      version: shelter.version,
    });
  }

  public clear(): void {
    this.baseRepo.clear();
  }

  public snapshot(): Map<string, ShelterProps> {
    return this.baseRepo.snapshot();
  }

  public restore(snap: Map<string, ShelterProps>): void {
    this.baseRepo.restore(snap);
  }
}
