import { NextResponse } from "next/server";
import { hydrateRecruiterWorkflow } from "@/lib/recruiterWorkflowStateHydration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const hydration = hydrateRecruiterWorkflow();
    return NextResponse.json({ ...hydration, mode: "workflow hydration; saved state preferred; no candidate DB writes" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to audit workflow" }, { status: 500 });
  }
}
