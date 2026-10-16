import { prisma } from "@/shared/infra/prisma/client";
import { RescueTeam } from "../../domain/entities/RescueTeam";
import { RescueTeamRepository } from "../repositories/RescueTeamRepository";
import { VersionConflictError } from "@/shared/infra/errors";

export class PrismaRescueTeamRepository implements RescueTeamRepository {
  public async findById(id: string): Promise<RescueTeam | null> {
    const raw = await prisma.rescueTeam.findUnique({ where: { id } });
    if (!raw) return null;
    return new RescueTeam({
      id: raw.id,
      districtId: raw.districtId,
      organizationId: raw.organizationId,
      name: raw.name,
      capability: raw.capability,
      status: raw.status as any,
      version: raw.version,
      currentLatitude: raw.currentLatitude ? Number(raw.currentLatitude) : undefined,
      currentLongitude: raw.currentLongitude ? Number(raw.currentLongitude) : undefined,
    });
  }

  public async findByDistrictId(districtId: string): Promise<RescueTeam[]> {
    const rawList = await prisma.rescueTeam.findMany({ where: { districtId } });
    return rawList.map(
      (raw: any) =>
        new RescueTeam({
          id: raw.id,
          districtId: raw.districtId,
          organizationId: raw.organizationId,
          name: raw.name,
          capability: raw.capability,
          status: raw.status as any,
          version: raw.version,
          currentLatitude: raw.currentLatitude ? Number(raw.currentLatitude) : undefined,
          currentLongitude: raw.currentLongitude ? Number(raw.currentLongitude) : undefined,
        })
    );
  }

  public async findAll(): Promise<RescueTeam[]> {
    const rawList = await prisma.rescueTeam.findMany();
    return rawList.map(
      (raw: any) =>
        new RescueTeam({
          id: raw.id,
          districtId: raw.districtId,
          organizationId: raw.organizationId,
          name: raw.name,
          capability: raw.capability,
          status: raw.status as any,
          version: raw.version,
          currentLatitude: raw.currentLatitude ? Number(raw.currentLatitude) : undefined,
          currentLongitude: raw.currentLongitude ? Number(raw.currentLongitude) : undefined,
        })
    );
  }

  public async save(team: RescueTeam): Promise<void> {
    const existing = await prisma.rescueTeam.findUnique({ where: { id: team.id } });
    if (!existing) {
      await prisma.rescueTeam.create({
        data: {
          id: team.id,
          districtId: team.districtId,
          organizationId: team.organizationId,
          name: team.name,
          capability: team.capability,
          status: team.status as any,
          version: team.version,
          currentLatitude: team.currentLatitude,
          currentLongitude: team.currentLongitude,
        },
      });
      return;
    }

    const result = await prisma.rescueTeam.updateMany({
      where: { id: team.id, version: existing.version },
      data: {
        status: team.status as any,
        version: { increment: 1 },
      },
    });

    if (result.count === 0) {
      throw new VersionConflictError(`Rescue team '${team.id}' was updated by another process`);
    }
  }
}
