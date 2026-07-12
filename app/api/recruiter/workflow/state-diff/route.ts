import { NextResponse } from "next/server";
import { buildRecruiterWorkflowAuditFromReports } from "@/lib/recruiterWorkflowAudit";
import { buildPersistedWorkflowStates } from "@/lib/recruiterWorkflowPersistence";
import { diffWorkflowStates } from "@/lib/recruiterWorkflowStateDiff";
import { readPersistedWorkflowState } from "@/lib/recruiterWorkflowStateHydration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const previous = readPersistedWorkflowState();
    const audit = buildRecruiterWorkflowAuditFromReports();
    const current = buildPersistedWorkflowStates(audit, previous?.states || []);
    return NextResponse.json(diffWorkflowStates(previous?.states || [], current));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to diff workflow state" }, { status: 500 });
  }
}
