import { prisma } from "@/shared/infra/prisma/client";
import { DispatchRequest } from "../../domain/entities/DispatchRequest";
import { DispatchRequestRepository } from "../repositories/DispatchRequestRepository";

export class PrismaDispatchRequestRepository implements DispatchRequestRepository {
  public async findById(id: string): Promise<DispatchRequest | null> {
    const raw = await prisma.dispatchRequest.findUnique({ where: { id } });
    if (!raw) return null;
    return new DispatchRequest({
      id: raw.id,
      districtId: raw.districtId,
      incident: raw.incident ?? undefined,
      location: raw.location,
      requestedBy: raw.requestedBy,
      status: raw.status as any,
      teamId: raw.teamId ?? undefined,
      actionId: raw.actionId,
      occurredAt: raw.occurredAt,
    });
  }

  public async findUnassignedByDistrictId(districtId: string): Promise<DispatchRequest[]> {
    const rawList = await prisma.dispatchRequest.findMany({
      where: { districtId, status: "UNASSIGNED" },
    });
    return rawList.map(
      (raw: any) =>
        new DispatchRequest({
          id: raw.id,
          districtId: raw.districtId,
          incident: raw.incident ?? undefined,
          location: raw.location,
          requestedBy: raw.requestedBy,
          status: raw.status as any,
          teamId: raw.teamId ?? undefined,
          actionId: raw.actionId,
          occurredAt: raw.occurredAt,
        })
    );
  }

  public async save(request: DispatchRequest): Promise<void> {
    const existing = await prisma.dispatchRequest.findUnique({ where: { id: request.id } });
    if (!existing) {
      await prisma.dispatchRequest.create({
        data: {
          id: request.id,
          districtId: request.districtId,
          incident: request.incident,
          location: request.location,
          requestedBy: request.requestedBy,
          status: request.status as any,
          teamId: request.teamId,
          actionId: request.actionId,
          occurredAt: request.occurredAt,
        },
      });
      return;
    }

    await prisma.dispatchRequest.update({
      where: { id: request.id },
      data: {
        status: request.status as any,
        teamId: request.teamId,
      },
    });
  }
}
