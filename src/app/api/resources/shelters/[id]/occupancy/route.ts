import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { uc3 } from "@/shared/infra/container";
import { toErrorResponse } from "@/shared/infra/http/errorResponse";
import { getActor, requireRole } from "../../../_lib/tempActor";

const updateOccupancySchema = z.object({
  actionId: z.string().min(1),
  expectedVersion: z.number().int().nonnegative(),
  newCount: z.number().int().nonnegative(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getActor(request);
    requireRole(actor, ["DISTRICT_OFFICER"]);

    const { id } = await context.params;
    const body = await request.json();
    const payload = updateOccupancySchema.parse(body);

    const shelter = await uc3.shelters.updateOccupancy({
      actionId: payload.actionId,
      actor,
      shelterId: id,
      expectedVersion: payload.expectedVersion,
      newCount: payload.newCount,
    });

    return NextResponse.json(shelter, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
