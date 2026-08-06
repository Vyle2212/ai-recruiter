import { NextResponse } from "next/server";
import { loadCandidate360Profile } from "@/lib/candidate360Data";
import { answerCandidateHiringQuestion } from "@/lib/candidate360HiringAnalyst";
import { validateHiringAnalystRequest } from "@/lib/candidate360HiringAnalystRequest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_QUESTION_LENGTH = 1000;

export async function POST(request: Request, context: { params: Promise<{ candidateId: string }> }) {
  try {
    const { candidateId: encodedCandidateId } = await context.params;
    const candidateId = decodeURIComponent(encodedCandidateId).trim();
    if (!candidateId) return NextResponse.json({ error: "Candidate ID is required." }, { status: 400 });
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
    const validation = validateHiringAnalystRequest(candidateId, body, MAX_QUESTION_LENGTH);
    if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });
    const { question, job } = validation.value;
    const profile = await loadCandidate360Profile(candidateId);
    if (!profile) return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
    return NextResponse.json(answerCandidateHiringQuestion(profile, job, question));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to analyze candidate evidence." }, { status: 500 });
  }
}

