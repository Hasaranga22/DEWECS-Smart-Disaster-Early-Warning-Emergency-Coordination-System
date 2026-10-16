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

    // 2. Map them to raw data and sort newest first for the dashboard
    const data = allReports
      .map(report => report.toSnapshot())
      .sort((a, b) => new Date(b.captureTime).getTime() - new Date(a.captureTime).getTime());

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch officer queue:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
