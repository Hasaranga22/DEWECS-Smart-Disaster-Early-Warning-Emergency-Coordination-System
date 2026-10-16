export interface RiverBasin {
  id: string;
  name: string;
  description?: string;
  districtIds: string[]; // many-to-many "spans" relation
}