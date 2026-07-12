import { NextResponse } from "next/server";
import { buildRecruiterWorkflowAuditFromReports } from "@/lib/recruiterWorkflowAudit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(buildRecruiterWorkflowAuditFromReports());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to audit workflow" }, { status: 500 });
  }
}
