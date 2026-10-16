import { NextResponse } from "next/server";
import { z } from "zod";
import { reports } from "@/shared/infra/container";

const querySchema = z.object({
  reporterId: z.string().uuid("A valid reporter ID is required"),
});

/**
 * GET /api/reports/mine?reporterId=<uuid>
 *
 * Returns the signed-in citizen's reports. Authentication will supply the
 * reporter ID when it is added; the current prototype uses its demo identity.
 */
export async function GET(request: Request) {
  const result = querySchema.safeParse({
    reporterId: new URL(request.url).searchParams.get("reporterId"),
  });

  if (!result.success) {
    return NextResponse.json({ error: "Invalid reporter ID" }, { status: 400 });
  }

  try {
    const mine = await reports.findByReporter(result.data.reporterId);
    const data = mine
      .map((report) => report.toSnapshot())
      .sort((a, b) => b.captureTime.getTime() - a.captureTime.getTime());

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch citizen reports:", error);
    return NextResponse.json({ error: "Unable to load reports" }, { status: 500 });
  }
}
