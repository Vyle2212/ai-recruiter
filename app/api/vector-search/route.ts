import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createEmbedding } from "@/lib/embedding";
import { modulesForKeyword } from "@/lib/candidateSearchIndex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toBool(value: any) {
  const raw = String(value || "").toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

function maskEmail(email: any) {
  const e = String(email || "");
  const [name, domain] = e.split("@");
  if (!name || !domain) return "";
  return `${name.slice(0, 2)}***@${domain}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const query = String(body.query || body.keyword || body.q || "").trim();
    if (!query) {
      return NextResponse.json({ error: "Missing query" }, { status: 400 });
    }

    const country = String(body.country || "").trim();
    const minYears = Number(body.minYears || body.years || 0);
    const contactableOnly = toBool(body.contactableOnly || body.contactOnly);
    const limit = Math.min(Number(body.limit || 100), 300);
    const modules = Array.from(new Set([...(body.modules || []), ...modulesForKeyword(query)].filter(Boolean)));

    const embedding = await createEmbedding(query);

    const { data: vectorRows, error: rpcError } = await supabase.rpc("search_candidate_index_vector", {
      p_embedding: embedding,
      p_modules: modules.length ? modules : null,
      p_country: country || null,
      p_min_years: minYears || 0,
      p_contactable_only: contactableOnly,
      p_limit: limit,
    });

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    const ids = (vectorRows || []).map((r: any) => r.candidate_id);
    if (!ids.length) return NextResponse.json({ success: true, count: 0, results: [] });

    const { data: candidates, error } = await supabase
      .from("candidates")
      .select(`
        id,
        name,
        email,
        phone,
        location,
        current_location,
        current_title,
        title,
        country,
        years,
        years_experience,
        primary_module,
        secondary_modules,
        sap_modules,
        sap_submodules,
        skills,
        role_type,
        consulting_level,
        current_company,
        company,
        expected_salary,
        visa_status,
        profile_quality_score,
        implementation_project_count,
        rollout_project_count,
        ams_support_project_count,
        s4hana_project_count,
        s4_implementation_count,
        s4_greenfield_count
      `)
      .in("id", ids);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const fitById = new Map((vectorRows || []).map((r: any) => [r.candidate_id, Number(r.search_fit || 0)]));
    const orderById = new Map(ids.map((id: string, idx: number) => [id, idx]));

    const results = (candidates || [])
      .sort((a: any, b: any) => Number(orderById.get(a.id) ?? 999999) - Number(orderById.get(b.id) ?? 999999))
      .map((c: any) => ({
        ...c,
        candidate_id: c.id,
        vectorFit: fitById.get(c.id) || 0,
        search_fit: fitById.get(c.id) || 0,
        email_masked: maskEmail(c.email),
        contactable: Boolean(c.email || c.phone),
        display_location: c.location || c.current_location || c.country || "",
        display_company: c.current_company || c.company || "",
        s4_implementation_projects: c.s4_implementation_count || c.s4hana_project_count || 0,
        rollout_projects: c.rollout_project_count || 0,
        greenfield_projects: c.s4_greenfield_count || 0,
      }));

    return NextResponse.json({
      success: true,
      count: results.length,
      results,
      data: results,
      debug: { query, modules, source: "candidate_search_index_vector" },
    });
  } catch (error: any) {
    console.error("Vector search failed:", error);
    return NextResponse.json({ error: error?.message || "Vector search failed" }, { status: 500 });
  }
}
