import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalize(value: string) {
  return decodeURIComponent(value || "").trim();
}

function boolish(value: any) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function getContactAccess(candidate: any, req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const role = String(params.get("role") || candidate.viewer_role || "recruiter").toLowerCase();
  const hasSubscription =
    params.get("subscription") === "true" ||
    boolish(candidate.client_has_subscription) ||
    boolish(candidate.subscription_active) ||
    boolish(candidate.contact_subscription_active);

  const adminApproved =
    params.get("adminApproved") === "true" ||
    boolish(candidate.contact_unlock_approved) ||
    boolish(candidate.admin_contact_approved) ||
    boolish(candidate.recruiter_contact_approved);

  const adminOverride = role === "admin" || boolish(candidate.admin_access);

  if (adminOverride) {
    return { canView: true, role: "admin", reason: "Admin access granted.", cta: "Contact visible" };
  }

  if (role === "client") {
    if (hasSubscription) {
      return {
        canView: true,
        role: "client",
        reason: "Visible under active client subscription.",
        cta: "Contact visible",
      };
    }

    return {
      canView: false,
      role: "client",
      reason: "Contact protected. Client contact details are available only with an active subscription package.",
      cta: "Upgrade subscription to unlock contact",
    };
  }

  if (role === "recruiter") {
    if (adminApproved) {
      return {
        canView: true,
        role: "recruiter",
        reason: "Admin approval granted for recruiter contact access.",
        cta: "Contact visible",
      };
    }

    return {
      canView: false,
      role: "recruiter",
      reason: "Contact protected. Recruiters must request admin approval before viewing full candidate contact details.",
      cta: "Request admin approval",
    };
  }

  if (role === "candidate") {
    return {
      canView: false,
      role: "candidate",
      reason: "Candidate view does not expose third-party contact data.",
      cta: "Contact locked",
    };
  }

  return {
    canView: false,
    role: "recruiter",
    reason: "Contact protected.",
    cta: "Contact locked",
  };
}

function redactCandidate(candidate: any, canViewContact: boolean) {
  const hasOriginalCv = Boolean(
    candidate.cv_url ||
      candidate.resume_url ||
      candidate.file_url ||
      candidate.original_cv ||
      candidate.originalCv
  );

  if (canViewContact) {
    return {
      ...candidate,
      has_original_cv: hasOriginalCv,
    };
  }

  const redacted = { ...candidate };

  // Keep email and phone available for a locked/blurred UI preview.
  // Do not expose direct CV URLs until subscription/admin approval is granted.
  redacted.cv_url = "";
  redacted.resume_url = "";
  redacted.file_url = "";
  redacted.original_cv = "";
  redacted.originalCv = "";
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
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const id = normalize(rawId);

    if (!id) {
      return NextResponse.json({ error: "Missing candidate id" }, { status: 400 });
    }

    let data: any = null;
    let error: any = null;

    if (isUuid(id)) {
      const result = await supabase.from("candidates").select("*").eq("id", id).maybeSingle();
      data = result.data;
      error = result.error;
    }

    if (!data && id.includes("@")) {
      const result = await supabase
        .from("candidates")
        .select("*")
        .ilike("email", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      data = result.data;
      error = result.error;
    }

    if (!data) {
      const result = await supabase
        .from("candidates")
        .select("*")
        .or(`candidate_slug.eq.${id},slug.eq.${id}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      data = result.data;
      error = result.error;
    }

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Candidate not found" },
        { status: 404 }
      );
    }

    const indexResult = await supabase
      .from("candidate_search_index")
      .select("*")
      .eq("candidate_id", data.id)
      .maybeSingle();

    data = mergeCandidateWithSearchIndex(data, indexResult.data);

    const contactAccess = getContactAccess(data, req);
    const safeCandidate = redactCandidate(data, contactAccess.canView);

    return NextResponse.json({
      candidate: {
        ...safeCandidate,
        contactAccess,
        viewerRole: contactAccess.role,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load candidate" },
      { status: 500 }
    );
  }
}
