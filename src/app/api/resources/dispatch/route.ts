import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { uc3 } from "@/shared/infra/container";
import { toErrorResponse } from "@/shared/infra/http/errorResponse";
import { getActor, requireRole } from "../_lib/tempActor";

const dispatchSchema = z.object({
  actionId: z.string().min(1),
  destinationDistrictId: z.string().uuid(),
  teamId: z.string().uuid().optional(),
  incident: z.string().optional(),
  location: z.string().min(1),
  isConfirmed: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const actor = await getActor(request);
    requireRole(actor, ["DISTRICT_OFFICER"]);

    const body = await request.json();
    const payload = dispatchSchema.parse(body);

    const result = await uc3.dispatch.dispatch({
      actor,
      ...payload,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
