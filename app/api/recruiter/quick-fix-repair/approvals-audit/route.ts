import { NextResponse } from "next/server";
import { buildQuickFixApprovalAudit } from "../../../../../lib/quickFixApprovalAudit";

export async function GET() {
  return NextResponse.json(buildQuickFixApprovalAudit());
}
