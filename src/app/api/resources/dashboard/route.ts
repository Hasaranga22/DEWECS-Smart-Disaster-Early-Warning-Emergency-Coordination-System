import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { uc3 } from "@/shared/infra/container";
import { toErrorResponse } from "@/shared/infra/http/errorResponse";
import { getActor, requireRole } from "../_lib/tempActor";

const querySchema = z.object({
  districtId: z.string().uuid("Invalid districtId UUID"),
});

export async function GET(request: NextRequest) {
  try {
    const actor = await getActor(request);
    requireRole(actor, ["DISTRICT_OFFICER"]);

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const { districtId } = querySchema.parse(searchParams);

    const data = await uc3.dashboard.getDashboard(actor, districtId);
    return NextResponse.json(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}
