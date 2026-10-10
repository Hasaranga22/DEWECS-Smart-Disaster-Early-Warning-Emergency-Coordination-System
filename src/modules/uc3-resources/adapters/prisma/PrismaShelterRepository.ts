import { prisma } from "@/shared/infra/prisma/client";
import { Shelter } from "../../domain/entities/Shelter";
import { ShelterRepository } from "../repositories/ShelterRepository";
import { VersionConflictError } from "@/shared/infra/errors";

export class PrismaShelterRepository implements ShelterRepository {
  public async findById(id: string): Promise<Shelter | null> {
    const raw = await prisma.shelter.findUnique({ where: { id } });
    if (!raw) return null;
    return new Shelter({
      id: raw.id,
      districtId: raw.districtId,
      organizationId: raw.organizationId,
      name: raw.name,
      address: raw.address,
      latitude: raw.latitude ? Number(raw.latitude) : undefined,
      longitude: raw.longitude ? Number(raw.longitude) : undefined,
      capacity: raw.capacity,
      occupancy: raw.occupancy,
      version: raw.version,
    });
  }

  public async findByDistrictId(districtId: string): Promise<Shelter[]> {
    const rawList = await prisma.shelter.findMany({ where: { districtId } });
    return rawList.map(
      (raw: any) =>
        new Shelter({
          id: raw.id,
          districtId: raw.districtId,
          organizationId: raw.organizationId,
          name: raw.name,
          address: raw.address,
          latitude: raw.latitude ? Number(raw.latitude) : undefined,
          longitude: raw.longitude ? Number(raw.longitude) : undefined,
          capacity: raw.capacity,
          occupancy: raw.occupancy,
          version: raw.version,
        })
    );
  }

  public async findAll(): Promise<Shelter[]> {
    const rawList = await prisma.shelter.findMany();
    return rawList.map(
      (raw: any) =>
        new Shelter({
          id: raw.id,
          districtId: raw.districtId,
          organizationId: raw.organizationId,
          name: raw.name,
          address: raw.address,
          latitude: raw.latitude ? Number(raw.latitude) : undefined,
          longitude: raw.longitude ? Number(raw.longitude) : undefined,
          capacity: raw.capacity,
          occupancy: raw.occupancy,
          version: raw.version,
        })
    );
  }

  public async save(shelter: Shelter): Promise<void> {
    const existing = await prisma.shelter.findUnique({ where: { id: shelter.id } });
    if (!existing) {
      await prisma.shelter.create({
        data: {
          id: shelter.id,
          districtId: shelter.districtId,
          organizationId: shelter.organizationId,
          name: shelter.name,
          address: shelter.address,
          latitude: shelter.latitude,
          longitude: shelter.longitude,
          capacity: shelter.capacity,
          occupancy: shelter.occupancy,
          status: shelter.status,
          version: shelter.version,
        },
      });
      return;
    }

    const result = await prisma.shelter.updateMany({
      where: {
        id: shelter.id,
        version: existing.version,
      },
      data: {
        occupancy: shelter.occupancy,
        status: shelter.status,
        version: { increment: 1 },
      },
    });

    if (result.count === 0) {
      throw new VersionConflictError(`Shelter '${shelter.id}' was updated by another process`);
    }
  }
}
