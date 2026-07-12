import { NextResponse } from "next/server";
import { buildRecruiterWorkflowAuditFromReports } from "@/lib/recruiterWorkflowAudit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const audit = buildRecruiterWorkflowAuditFromReports();
    return NextResponse.json({ summary: audit.summary, actionQueue: audit.actionQueue, generatedAt: audit.generatedAt });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load workflow summary" }, { status: 500 });
  }
}
