import { NextResponse } from "next/server";
import { z } from "zod";
import { uc2 } from "@/shared/infra/container";
import { ValidationError, DuplicateLocalIdError } from "@/modules/uc2-report/domain/errors";

// 1. Zod schema for incoming JSON (matches ReportDraft interface perfectly)
const submitReportSchema = z.object({
  reporterId: z.string().min(1, "Reporter ID is required"),
  districtId: z.string().min(1, "District ID is required"),
  hazardType: z.enum(["FLOOD", "LANDSLIDE", "CYCLONE", "DROUGHT", "OTHER"]),
  description: z.string().min(10, "Description must be at least 10 characters"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  locationSource: z.enum(["GPS", "MANUAL_PIN"]),
  gpsAccuracyM: z.number().optional(),
  photo: z.string().optional(),
  localId: z.string().min(1, "Local ID is required for idempotency"),
  captureTime: z.string().transform((str) => new Date(str)),
});

/**
 * POST /api/reports
 * 
 * Used by the citizen frontend to submit a new ground report (or sync an offline one).
 */
export async function POST(request: Request) {
  // Declare rawBody outside try/catch so the catch block can read the localId if needed
  let rawBody: any = null;
  
  try {
    // Read and parse the JSON payload
    rawBody = await request.json();
    const parseResult = submitReportSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const draft = parseResult.data;

    // Pass the perfectly typed draft to the SubmissionService.
    // We pass `isOnline = true` because if it hit this API route, it must be online!
    const result = await uc2.submissionService.submit(draft, true);

    return NextResponse.json(result, { status: 201 });

  } catch (error) {
    // Centralized Domain Error mapping
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message, invalidFields: error.fields },
        { status: 400 }
      );
    }
    
    if (error instanceof DuplicateLocalIdError) {
      // Return 200 OK because the sync idempotency rule says if it exists, treat as success!
      return NextResponse.json(
        { message: "Already synced", localId: rawBody?.localId },
        { status: 200 }
      );
    }

    console.error("Failed to submit report:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
