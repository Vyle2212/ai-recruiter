import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnyRecord = Record<string, any>;

function n(value: any, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function cleanString(value: any) {
  return String(value ?? "").replace(/\u0000/g, "").replace(/\s+/g, " ").trim();
}

function cleanArray(value: any): string[] {
  if (Array.isArray(value)) return value.map(cleanString).filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return cleanArray(parsed);
    } catch {}
    return value.split(/[,;|\n]+/).map(cleanString).filter(Boolean);
  }
  return [];
}

function normalizeStatus(value: any, fallback = "Not verified") {
  const clean = cleanString(value);
  return clean || fallback;
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as AnyRecord;
    const id = cleanString(body.id || body.candidate_id || body.candidateId);
    if (!id) return NextResponse.json({ error: "Candidate id is required." }, { status: 400 });

    const payload: AnyRecord = {
      greenfield_projects: n(body.greenfield_projects ?? body.greenfieldProjects),
      rollout_projects: n(body.rollout_projects ?? body.rolloutProjects),
      brownfield_projects: n(body.brownfield_projects ?? body.brownfieldProjects),
      selective_transformation_projects: n(body.selective_transformation_projects ?? body.selectiveTransformationProjects),
      s4_implementation_projects: n(body.s4_implementation_projects ?? body.s4ImplementationProjects),
      s4_ams_projects: n(body.s4_ams_projects ?? body.s4AmsProjects),
      visa_status: normalizeStatus(body.visa_status ?? body.visaStatus),
      work_authorization: normalizeStatus(body.work_authorization ?? body.workAuthorization ?? body.visa_status ?? body.visaStatus),
      languages: cleanArray(body.languages),
      language_skills: cleanArray(body.languages),
      availability_status: normalizeStatus(body.availability_status ?? body.availabilityStatus),
      availability_timeline: normalizeStatus(body.availability_timeline ?? body.availabilityTimeline ?? body.availableWithin),
      relocation: normalizeStatus(body.relocation),
      relocation_willingness: normalizeStatus(body.relocation_willingness ?? body.relocation),
      employment_type: normalizeStatus(body.employment_type ?? body.employmentType),
      employment_preference: normalizeStatus(body.employment_preference ?? body.employmentPreference ?? body.employment_type ?? body.employmentType),
      expected_salary: n(body.expected_salary ?? body.expectedSalary),
      expected_salary_currency: normalizeStatus(body.expected_salary_currency ?? body.expectedSalaryCurrency ?? body.salary_currency ?? body.salaryCurrency, ""),
      project_extraction_confidence: "Candidate confirmed",
      project_extraction_source: "Candidate Portal",
      profile_last_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    Object.keys(payload).forEach((key) => {
      if (payload[key] === "" || payload[key] === undefined) delete payload[key];
    });

    const { data, error } = await supabase
      .from("candidates")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, candidate: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to update candidate profile." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return PATCH(req);
}
