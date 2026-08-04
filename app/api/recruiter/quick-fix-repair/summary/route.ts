import { NextResponse } from "next/server";
import { buildQuickFixRepairAudit } from "../../../../../lib/quickFixRepairAudit";

export async function GET() {
  return NextResponse.json(buildQuickFixRepairAudit());
}
