import { NextResponse } from "next/server";
import { buildRepairQueueCandidate360 } from "@/lib/repairQueueCandidate360";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, context: { params: Promise<{ candidateId: string }> }) {
  try {
    const { candidateId } = await context.params;
    const panel = buildRepairQueueCandidate360(candidateId);
    if (!panel) return NextResponse.json({ error: "Candidate repair queue item not found" }, { status: 404 });
    return NextResponse.json(panel);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load candidate repair panel" }, { status: 500 });
  }
}
