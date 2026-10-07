import { NextResponse } from "next/server";
import { z } from "zod";
import { uc2 } from "@/shared/infra/container";
import { InvalidStateTransitionError, VersionConflictError } from "@/modules/uc2-report/domain/errors";

const reviewSchema = z.object({
  action: z.enum(["verify", "reject", "requestInfo"]),
  expectedVersion: z.number(),
  officerId: z.string().min(1, "Officer ID is required"),
  // Required only for 'verify'
  severityIndication: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  // Required only for 'reject'
  reason: z.string().optional()
});

/**
 * POST /api/officer/reports/[id]/review
 * 
 * Handles the state transitions (verify, reject, requestInfo) by a duty officer.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> } // Note: params must be awaited in Next 16
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parseResult = reviewSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ error: "Invalid payload", details: parseResult.error.format() }, { status: 400 });
    }

    const { action, expectedVersion, officerId, severityIndication, reason } = parseResult.data;

    // Route to the correct ReviewService method based on the action
    let resultReport;
    
    if (action === "verify") {
      if (!severityIndication) throw new Error("Severity Indication is required to verify a report.");
      resultReport = await uc2.reviewService.verify({ reportId: id, expectedVersion, officerId, severityIndication });
    } 
    else if (action === "reject") {
      if (!reason) throw new Error("A reason is required to reject a report.");
      resultReport = await uc2.reviewService.reject({ reportId: id, expectedVersion, officerId, reason });
    }
    else if (action === "requestInfo") {
      resultReport = await uc2.reviewService.requestInfo({ reportId: id, expectedVersion, officerId });
    }

    return NextResponse.json(resultReport?.toSnapshot(), { status: 200 });

  } catch (error: any) {
    if (error instanceof VersionConflictError) {
      return NextResponse.json({ error: "CONCURRENCY_ERROR", message: "Another officer already reviewed this report. Please refresh your queue." }, { status: 409 });
    }
    if (error instanceof InvalidStateTransitionError) {
      return NextResponse.json({ error: "STATE_ERROR", message: error.message }, { status: 400 });
    }
    
    console.error("Review action failed:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
