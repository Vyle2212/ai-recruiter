import { NextRequest, NextResponse } from "next/server";
import { applyCandidateValidationAction, buildCandidateValidationState, serializeCandidateValidationState, type CandidateValidationAction } from "@/lib/candidateValidation";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnyRecord = Record<string, any>;

function clean(value: any) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

async function loadCandidate(id: string) {
  const byId = await supabase.from("candidates").select("*").eq("id", id).maybeSingle();
  if (byId.data) return { candidate: byId.data as AnyRecord, error: null };
  if (byId.error) return { candidate: null, error: byId.error.message };
  return { candidate: null, error: "Candidate not found." };
}

function actionValue(action: CandidateValidationAction, value: any) {
  if (action === "approve-sap-years" && value !== undefined && value !== "") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : undefined;
  }
  return value;
}

async function persistValidation(candidateId: string, candidate: AnyRecord, state: ReturnType<typeof buildCandidateValidationState>) {
  const payload = {
    validation_status: state.status,
    validation_score: state.score,
    validation_state: serializeCandidateValidationState(state),
    validation_history: state.history,
    validation_updated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("candidates")
    .update(payload)
    .eq("id", candidateId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data || { ...candidate, ...payload };
}

export async function GET(req: NextRequest) {
  try {
    const id = clean(req.nextUrl.searchParams.get("id") || req.nextUrl.searchParams.get("candidateId"));
    if (!id) return NextResponse.json({ error: "Candidate id is required." }, { status: 400 });

    const { candidate, error } = await loadCandidate(id);
    if (!candidate) return NextResponse.json({ error }, { status: 404 });

    return NextResponse.json({ ok: true, state: buildCandidateValidationState(candidate) });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to load candidate validation." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as AnyRecord;
    const candidateId = clean(body.candidateId || body.candidate_id || body.id);
    const action = clean(body.action) as CandidateValidationAction;
    if (!candidateId) return NextResponse.json({ error: "Candidate id is required." }, { status: 400 });
    if (!action) return NextResponse.json({ error: "Validation action is required." }, { status: 400 });

    const { candidate, error } = await loadCandidate(candidateId);
    if (!candidate) return NextResponse.json({ error }, { status: 404 });

    const current = buildCandidateValidationState(candidate);
    const applied = applyCandidateValidationAction(current, action, {
      value: actionValue(action, body.value),
      reason: body.reason,
      user: body.user || body.recruiter || "recruiter",
    });
    const recomputed = buildCandidateValidationState({
      ...candidate,
      validation_status: applied.status,
      validation_state: serializeCandidateValidationState(applied),
    });
    const saved = await persistValidation(candidateId, candidate, recomputed);

    return NextResponse.json({ ok: true, state: buildCandidateValidationState(saved), candidate: saved });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to update candidate validation." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return PATCH(req);
}
