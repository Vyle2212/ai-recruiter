import { NextResponse } from "next/server";
import { hydrateCandidate360Workflow } from "@/lib/recruiterWorkflowStateHydration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, context: { params: Promise<{ candidateId: string }> }) {
  try {
    const { candidateId } = await context.params;
    const panel = hydrateCandidate360Workflow(candidateId);
    if (!panel) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    return NextResponse.json(panel);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load candidate workflow" }, { status: 500 });
  }
}
