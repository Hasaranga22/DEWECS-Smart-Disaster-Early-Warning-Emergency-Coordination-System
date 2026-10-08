import { OverCapacityError } from "../errors";
import { OccupancyCount } from "../valueObjects/OccupancyCount";

export type ShelterStatus = "OPEN" | "FULL";

export interface ShelterProps {
  id: string;
  districtId: string;
  organizationId: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  capacity: number;
  occupancy: number;
  version?: number;
}

export interface AlternativeShelter {
  id: string;
  name: string;
  availableCapacity: number;
}

export class Shelter {
  public readonly id: string;
  public readonly districtId: string;
  public readonly organizationId: string;
  public readonly name: string;
  public readonly address: string;
  public readonly latitude?: number;
  public readonly longitude?: number;
  public readonly capacity: number;
  public readonly occupancy: number;
  public readonly status: ShelterStatus;
  public readonly version: number;

  constructor(props: ShelterProps) {
    this.id = props.id;
    this.districtId = props.districtId;
    this.organizationId = props.organizationId;
    this.name = props.name;
    this.address = props.address;
    this.latitude = props.latitude;
    this.longitude = props.longitude;
    this.capacity = props.capacity;
    this.occupancy = props.occupancy;
    this.version = props.version ?? 0;
    this.status = this.occupancy >= this.capacity ? "FULL" : "OPEN";
  }

  public get availableCapacity(): number {
    return Math.max(0, this.capacity - this.occupancy);
  }

  public withOccupancy(newCountInput: number, alternatives: AlternativeShelter[] = []): Shelter {
    const validatedCount = new OccupancyCount(newCountInput).value;
    if (validatedCount > this.capacity) {
      throw new OverCapacityError(
        `Shelter '${this.name}' capacity exceeded: requested ${validatedCount}, capacity ${this.capacity}`,
        alternatives
      );
    }

    return new Shelter({
      id: this.id,
      districtId: this.districtId,
      organizationId: this.organizationId,
      name: this.name,
      address: this.address,
      latitude: this.latitude,
      longitude: this.longitude,
      capacity: this.capacity,
      occupancy: validatedCount,
      version: this.version + 1,
    });
  }
}
