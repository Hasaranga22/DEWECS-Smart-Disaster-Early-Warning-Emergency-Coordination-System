import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { uc3 } from "@/shared/infra/container";
import { toErrorResponse } from "@/shared/infra/http/errorResponse";
import { getActor, requireRole } from "../../../_lib/tempActor";

const advanceTeamSchema = z.object({
  targetStatus: z.enum(["ON_SITE", "RETURNING", "AVAILABLE"]),
  incident: z.string().optional(),
  location: z.string().optional(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getActor(request);
    requireRole(actor, ["DISTRICT_OFFICER"]);

    const { id } = await context.params;
    const body = await request.json();
    const payload = advanceTeamSchema.parse(body);

    const team = await uc3.dispatch.advanceTeam({
      actor,
      teamId: id,
      targetStatus: payload.targetStatus,
      incident: payload.incident,
      location: payload.location,
    });

    return NextResponse.json(team, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
