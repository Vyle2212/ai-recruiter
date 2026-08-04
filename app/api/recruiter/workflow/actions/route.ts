import { NextRequest, NextResponse } from "next/server";
import { buildRecruiterWorkflowAuditFromReports } from "@/lib/recruiterWorkflowAudit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const audit = buildRecruiterWorkflowAuditFromReports();
    const state = audit.states.find((item) => item.candidateId === body.candidateId);
    if (!state) return NextResponse.json({ error: "Candidate workflow state not found" }, { status: 404 });
    return NextResponse.json({ mode: "dry-run action preview only; no candidate DB writes", decision: { action: body.action, allowed: true, reasons: ["Report-backed workflow action preview"], previewOnly: true }, candidateId: body.candidateId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to preview workflow action" }, { status: 500 });
  }
}
