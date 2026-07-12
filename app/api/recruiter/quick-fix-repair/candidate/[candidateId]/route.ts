import { NextResponse } from "next/server";
import { buildQuickFixCandidate360Panel } from "../../../../../../lib/quickFixRepairCandidate360";

export async function GET(_request: Request, { params }: { params: Promise<{ candidateId: string }> }) {
  const { candidateId } = await params;
  return NextResponse.json(buildQuickFixCandidate360Panel(candidateId));
}
