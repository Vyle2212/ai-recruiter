import { NextResponse } from "next/server";
import { buildBatchDecisionAudit } from "@/lib/aiExtractionBatchDecisionWorkflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(buildBatchDecisionAudit());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to audit batch decisions" }, { status: 500 });
  }
}
