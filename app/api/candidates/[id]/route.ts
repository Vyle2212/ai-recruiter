import { NextRequest, NextResponse } from "next/server";
import { createLazySupabaseServiceClient } from "@/lib/runtimeClients";
import {
  recruiterSearchAuthorizationDenied,
  recruiterSearchPrivateNoStoreHeaders,
  requireRecruiterSearchAuthorization,
} from "@/lib/recruiterSearchAuthorization";
import { originalCvReference } from "@/lib/originalCvArchiveKey";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalize(value: string) {
  return decodeURIComponent(value || "").trim();
}

function redactCandidate(candidate: any) {
  const hasOriginalCv = Boolean(originalCvReference(candidate.source_file));

  const redacted = { ...candidate };
  // Contact approval is intentionally DB-backed only. Until that workflow exists,
  // this endpoint never returns direct contact or source-document fields.
  redacted.email = "";
  redacted.phone = "";
  redacted.mobile = "";
  redacted.phone_number = "";
  redacted.cv_url = "";
  redacted.resume_url = "";
  redacted.file_url = "";
  redacted.original_cv = "";
  redacted.originalCv = "";
  // A raw CV embeds contact information even when scalar contact fields are
  // blank. The private source path is resolved only by the authorized route.
  for (const key of [
    "source_file", "sourceFile", "archivedCvReference", "raw_text",
    "resume_text", "raw_cv", "cv_text", "parsed_resume", "parsed_json",
    "normalized_email", "normalized_phone", "linkedin_url", "linkedinUrl",
  ]) delete redacted[key];
  redacted.has_original_cv = hasOriginalCv;
  redacted.contact_redacted = true;
  return redacted;
}

function mergeCandidateWithSearchIndex(candidate: any, indexRow: any) {
  if (!indexRow) return candidate;
  return {
    ...candidate,
    __index: indexRow,
    primary_module: indexRow.primary_module || candidate.primary_module,
    primaryModule: indexRow.primary_module || candidate.primaryModule || candidate.primary_module,
    secondary_modules: indexRow.all_modules || candidate.secondary_modules || [],
    sap_modules: indexRow.all_modules || candidate.sap_modules || [],
    sap_submodules: indexRow.all_submodules || candidate.sap_submodules || [],
    location: candidate.location || indexRow.display_location || indexRow.country,
    current_location: candidate.current_location || indexRow.display_location || indexRow.country,
    years: candidate.years ?? indexRow.years,
    profile_quality_score: candidate.profile_quality_score ?? indexRow.quality_score,
    greenfield_count: indexRow.greenfield_count ?? candidate.greenfield_count,
    brownfield_count: indexRow.brownfield_count ?? candidate.brownfield_count,
    rollout_count: indexRow.rollout_count ?? candidate.rollout_count,
    s4_count: indexRow.s4_count ?? candidate.s4_count,
    s4_ams_count: indexRow.s4_ams_count ?? candidate.s4_ams_count,
    ams_count: indexRow.ams_count ?? candidate.ams_count,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authorization = await requireRecruiterSearchAuthorization({
      permission: "candidate-detail:read",
      route: "/api/candidates/[id]",
    });
    if (!authorization.allowed) return recruiterSearchAuthorizationDenied(authorization);

    const { id: rawId } = await params;
    const id = normalize(rawId);

    if (!id) {
      return NextResponse.json({ error: "Missing candidate id" }, { status: 400 });
    }

    if (!isUuid(id)) {
      return NextResponse.json(
        { error: "Candidate id must be a UUID" },
        { status: 400, headers: recruiterSearchPrivateNoStoreHeaders },
      );
    }

    const supabase = createLazySupabaseServiceClient();
    let data: any = null;
    let error: any = null;

    if (isUuid(id)) {
      const result = await supabase.from("candidates").select("*").eq("id", id).maybeSingle();
      data = result.data;
      error = result.error;
    }

    if (error || !data) {
      return NextResponse.json({ error: error?.message || "Candidate not found" }, { status: 404, headers: recruiterSearchPrivateNoStoreHeaders });
    }

    const indexResult = await supabase
      .from("candidate_search_index")
      .select("*")
      .eq("candidate_id", data.id)
      .maybeSingle();

    data = mergeCandidateWithSearchIndex(data, indexResult.data);

    const contactAccess = {
      canView: false,
      role: authorization.scope.role,
      reason: "Contact protected until a DB-backed approval workflow is available.",
      cta: "Contact locked",
    };
    const safeCandidate = redactCandidate(data);

    return NextResponse.json({
      candidate: {
        ...safeCandidate,
        contactAccess,
        viewerRole: contactAccess.role,
      },
    }, { headers: recruiterSearchPrivateNoStoreHeaders });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load candidate" },
      { status: 500 }
    );
  }
}
