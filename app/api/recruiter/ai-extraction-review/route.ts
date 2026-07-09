import { NextResponse } from "next/server";
import { loadAiExtractionReviewReports } from "@/lib/aiExtractionReviewUi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(loadAiExtractionReviewReports());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load AI extraction review" },
      { status: 500 },
    );
  }
}
