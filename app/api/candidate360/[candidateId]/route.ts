import { NextResponse } from "next/server";
import { loadCandidate360Profile } from "@/lib/candidate360Data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ candidateId: string }> }) {
  try {
    const { candidateId } = await context.params;
    const profile = await loadCandidate360Profile(decodeURIComponent(candidateId).trim());
    if (!profile) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    return NextResponse.json(profile);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load Candidate360 profile" }, { status: 500 });
  }
}
