import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { uc3 } from "@/shared/infra/container";
import { toErrorResponse } from "@/shared/infra/http/errorResponse";
import { getActor, requireRole } from "../_lib/tempActor";

const createShelterSchema = z.object({
  districtId: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string().min(2).max(200),
  address: z.string().min(2),
  capacity: z.number().int().positive(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const actor = await getActor(request);
    requireRole(actor, ["DISTRICT_OFFICER"]);

    const body = await request.json();
    const payload = createShelterSchema.parse(body);

    const shelter = await uc3.shelters.registerShelter({
      actor,
      ...payload,
    });

    return NextResponse.json(shelter, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
