import { NextResponse } from "next/server";
import { hydrateRecruiterWorkflow } from "@/lib/recruiterWorkflowStateHydration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(hydrateRecruiterWorkflow());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load workflow state" }, { status: 500 });
  }
}
