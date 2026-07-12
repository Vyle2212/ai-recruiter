import { NextResponse } from "next/server";
import { loadQuickFixRepairSuggestions } from "../../../../../lib/quickFixRepairReview";

export async function GET() {
  return NextResponse.json(loadQuickFixRepairSuggestions());
}
