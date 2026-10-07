import { NextResponse } from "next/server";
import { reports } from "@/shared/infra/container";

/**
 * GET /api/officer/reports
 * 
 * Fetches all reports that require action from the Duty Officer.
 * Currently returns reports in PENDING_REVIEW or NEEDS_INFO state.
 */
export async function GET() {
  try {
    // 1. Fetch all reports from the database
    const allReports = await reports.findAll();

    // 2. Filter for actionable reports and map them to their raw data for the UI
    const actionable = allReports
      .map(report => report.toSnapshot())
      .filter(snap => snap.reviewStatus === "PENDING_REVIEW" || snap.reviewStatus === "NEEDS_INFO")
      // Sort oldest first (FIFO queue for officers)
      .sort((a, b) => new Date(a.captureTime).getTime() - new Date(b.captureTime).getTime());

    return NextResponse.json(actionable, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch officer queue:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
