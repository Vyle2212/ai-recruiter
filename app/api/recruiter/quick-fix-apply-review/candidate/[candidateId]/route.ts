import { NextResponse } from "next/server";
import { buildQuickFixApplyCandidate360 } from "../../../../../../lib/quickFixApplyCandidate360";
export async function GET(_request: Request, { params }: { params: Promise<{ candidateId: string }> }) {
  const { candidateId } = await params;
  return NextResponse.json(buildQuickFixApplyCandidate360(candidateId));
}
