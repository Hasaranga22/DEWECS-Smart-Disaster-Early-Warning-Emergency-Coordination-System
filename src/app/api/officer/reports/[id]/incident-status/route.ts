import { NextResponse } from "next/server";
import { z } from "zod";
import { InvalidStateTransitionError, VersionConflictError } from "@/modules/uc2-report/domain/errors";
import { uc2 } from "@/shared/infra/container";

const incidentStatusSchema = z.object({
  action: z.enum(["resolve", "extend"]),
  expectedVersion: z.number().int().nonnegative(),
  officerId: z.string().min(1, "Officer ID is required"),
  note: z.string().trim().max(500).optional(),
});

/** Resolves or extends a verified incident's live-map lifecycle. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body: unknown = await request.json();
    const parsed = incidentStatusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid incident lifecycle request" }, { status: 400 });
    }

    const input = {
      reportId: id,
      expectedVersion: parsed.data.expectedVersion,
      officerId: parsed.data.officerId,
      note: parsed.data.note,
    };
    const report = parsed.data.action === "resolve"
      ? await uc2.reviewService.resolveIncident(input)
      : await uc2.reviewService.extendIncident(input);

    return NextResponse.json(report.toSnapshot(), { status: 200 });
  } catch (error: unknown) {
    if (error instanceof VersionConflictError) {
      return NextResponse.json({ error: "CONCURRENCY_ERROR", message: "This incident changed. Refresh and try again." }, { status: 409 });
    }
    if (error instanceof InvalidStateTransitionError) {
      return NextResponse.json({ error: "STATE_ERROR", message: error.message }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Unable to update incident status.";
    return NextResponse.json({ error: "INCIDENT_STATUS_ERROR", message }, { status: 500 });
  }
}
