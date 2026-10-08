import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { uc3 } from "@/shared/infra/container";
import { toErrorResponse } from "@/shared/infra/http/errorResponse";
import { getActor, requireRole } from "../_lib/tempActor";

const distributeSchema = z.object({
  actionId: z.string().min(1),
  stockId: z.string().uuid(),
  destinationShelterId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

export async function POST(request: NextRequest) {
  try {
    const actor = await getActor(request);
    requireRole(actor, ["DISTRICT_OFFICER"]);

    const body = await request.json();
    const payload = distributeSchema.parse(body);

    const distribution = await uc3.distributions.distribute({
      actor,
      ...payload,
    });

    return NextResponse.json(distribution, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
