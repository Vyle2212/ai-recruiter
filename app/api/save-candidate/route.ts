import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { modulesForKeyword } from "@/lib/candidateSearchIndex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function firstParam(url: URL, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = url.searchParams.get(key);
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return fallback;
}

function parseList(value: string) {
  return String(value || "").split(/[,\|;]/).map((x) => x.trim()).filter(Boolean);
}

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

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const keyword = firstParam(url, ["keyword", "q", "search"], "");
    const moduleParam = firstParam(url, ["module", "sapSkill", "sapSkills"], "");
    const country = firstParam(url, ["country"], "");
    const city = firstParam(url, ["city"], "");
    const minYears = Number(firstParam(url, ["minYears", "years"], "0") || 0);
    const minQuality = Number(firstParam(url, ["minQuality"], "0") || 0);
    const contactableOnly = toBool(firstParam(url, ["contactableOnly", "contactOnly"], "false"));
    const limit = Math.min(Number(firstParam(url, ["limit"], "100") || 100), 300);

    const modules = Array.from(new Set([...modulesForKeyword(keyword), ...parseList(moduleParam).flatMap(modulesForKeyword)].filter(Boolean)));

    const { data: indexRows, error: rpcError } = await supabase.rpc("search_candidate_index_v2", {
      p_keyword: keyword || null,
      p_modules: modules.length ? modules : null,
      p_country: country || null,
      p_city: city || null,
      p_min_years: minYears || 0,
      p_contactable_only: contactableOnly,
      p_min_quality: minQuality || 0,
      p_limit: limit,
    });

    if (rpcError) return NextResponse.json({ error: rpcError.message }, { status: 500 });

    const ids = (indexRows || []).map((r: any) => r.candidate_id);
    if (!ids.length) return NextResponse.json({ success: true, count: 0, results: [], data: [] });

    const { data: candidates, error } = await supabase.from("candidates").select("*").in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const fitById = new Map((indexRows || []).map((r: any) => [r.candidate_id, Number(r.search_fit || 0)]));
    const orderById = new Map(ids.map((id: string, idx: number) => [id, idx]));

    const results = (candidates || [])
      .sort((a: any, b: any) => Number(orderById.get(a.id) ?? 999999) - Number(orderById.get(b.id) ?? 999999))
      .map((c: any) => ({
        ...c,
        id: c.id,
        candidate_id: c.id,
        searchFit: fitById.get(c.id) || 0,
        search_fit: fitById.get(c.id) || 0,
        email_masked: maskEmail(c.email),
        contactable: Boolean(c.email || c.phone),
      }));

    return NextResponse.json({ success: true, count: results.length, results, data: results, debug: { keyword, modules, source: "candidate_search_index_v2" } });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Search candidates failed" }, { status: 500 });
  }
}
