import { prisma } from "@/shared/infra/prisma/client";
import { TeamStatusEvent } from "../../domain/entities/TeamStatusEvent";
import { TeamStatusEventRepository } from "../repositories/TeamStatusEventRepository";

export class PrismaTeamStatusEventRepository implements TeamStatusEventRepository {
  public async findById(id: string): Promise<TeamStatusEvent | null> {
    const raw = await prisma.teamStatusEvent.findUnique({ where: { id } });
    if (!raw) return null;
    return new TeamStatusEvent({
      id: raw.id,
      teamId: raw.teamId,
      fromStatus: raw.fromStatus as any,
      toStatus: raw.toStatus as any,
      actorId: raw.actorId,
      occurredAt: raw.occurredAt,
      incident: raw.incident ?? undefined,
      location: raw.location ?? undefined,
    });
  }

  public async findByTeamId(teamId: string): Promise<TeamStatusEvent[]> {
    const rawList = await prisma.teamStatusEvent.findMany({ where: { teamId } });
    return rawList.map(
      (raw: any) =>
        new TeamStatusEvent({
          id: raw.id,
          teamId: raw.teamId,
          fromStatus: raw.fromStatus as any,
          toStatus: raw.toStatus as any,
          actorId: raw.actorId,
          occurredAt: raw.occurredAt,
          incident: raw.incident ?? undefined,
          location: raw.location ?? undefined,
        })
    );
  }

  public async save(event: TeamStatusEvent): Promise<void> {
    await prisma.teamStatusEvent.create({
      data: {
        id: event.id,
        teamId: event.teamId,
        fromStatus: event.fromStatus as any,
        toStatus: event.toStatus as any,
        actorId: event.actorId,
        occurredAt: event.occurredAt,
        incident: event.incident,
        location: event.location,
      },
    });
  }
}
