import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { uc3 } from "@/shared/infra/container";
import { toErrorResponse } from "@/shared/infra/http/errorResponse";
import { getActor, requireRole } from "../../../_lib/tempActor";

const resolveSchema = z.object({
  resolution: z.enum(["RETRY", "DISCARD"]),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getActor(request);
    requireRole(actor, ["DISTRICT_OFFICER"]);

    const { id } = await context.params;
    const body = await request.json();
    const payload = resolveSchema.parse(body);

    const resolvedItem = await uc3.conflictQueue.resolve(id, payload.resolution, actor.id);
    return NextResponse.json(resolvedItem, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
