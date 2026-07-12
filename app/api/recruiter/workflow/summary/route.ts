import { NextResponse } from "next/server";
import { hydrateRecruiterWorkflow } from "@/lib/recruiterWorkflowStateHydration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const hydration = hydrateRecruiterWorkflow();
    return NextResponse.json({ summary: hydration.summary, actionQueue: hydration.actionQueue, generatedAt: hydration.generatedAt, lastUpdatedAt: hydration.lastUpdatedAt, stateSource: hydration.stateSource });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load workflow summary" }, { status: 500 });
  }
}
