import { Shelter } from "../../domain/entities/Shelter";

export interface ShelterRepository {
  findById(id: string): Promise<Shelter | null>;
  findByDistrictId(districtId: string): Promise<Shelter[]>;
  findAll(): Promise<Shelter[]>;
  save(shelter: Shelter): Promise<void>;
}
