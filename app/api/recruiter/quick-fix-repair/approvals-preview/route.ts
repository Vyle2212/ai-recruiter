import { NextResponse } from "next/server";
import { buildQuickFixApprovalPreview } from "../../../../../lib/quickFixRepairApprovalBridge";
import { loadQuickFixRepairSuggestions } from "../../../../../lib/quickFixRepairReview";

export async function GET() {
  return NextResponse.json(buildQuickFixApprovalPreview(loadQuickFixRepairSuggestions()));
}
