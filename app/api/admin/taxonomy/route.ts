import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { COMPANY_TAXONOMY, SAP_SKILL_TAXONOMY } from "@/lib/sapTalentTaxonomy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TaxonomyType = "sap" | "company";

type SapPayload = {
  code: string;
  name: string;
  category: string;
  aliases: string[];
  submodules: string[];
  active: boolean;
};

type CompanyPayload = {
  name: string;
  category: string;
  country?: string;
  countries?: string[];
  aliases: string[];
  active: boolean;
};

function normalizeType(value: string | null): TaxonomyType {
  return value === "company" ? "company" : "sap";
}

function tableFor(type: TaxonomyType) {
  return type === "sap" ? "sap_modules" : "consulting_firms";
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[,;|\n]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const type = normalizeType(url.searchParams.get("type"));
  const table = tableFor(type);
  const orderColumn = type === "sap" ? "code" : "name";

  const { data, error } = await supabase
    .from(table)
    .select("*")
    .order(orderColumn, { ascending: true });

  if (!error && data?.length) {
    return NextResponse.json({ source: "database", records: data });
  }

  return NextResponse.json({
    source: "local taxonomy fallback",
    records: type === "sap" ? SAP_SKILL_TAXONOMY : COMPANY_TAXONOMY,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const type = normalizeType(body?.type || "sap");
  const record = body?.record || {};

  if (type === "sap") {
    const payload: SapPayload = {
      code: String(record.code || "").trim(),
      name: String(record.name || "").trim(),
      category: String(record.category || "OTHER").trim(),
      aliases: toStringArray(record.aliases),
      submodules: toStringArray(record.submodules),
      active: record.active !== false,
    };

    if (!payload.code) {
      return NextResponse.json(
        { error: "SAP module code is required" },
        { status: 400 },
      );
    }

    if (!payload.name) {
      return NextResponse.json(
        { error: "SAP module name is required" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("sap_modules")
      .upsert(payload as any, { onConflict: "code" })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ record: data });
  }

  const countries = toStringArray(record.countries);
  const payload: CompanyPayload = {
    name: String(record.name || "").trim(),
    category: String(record.category || "OTHER").trim(),
    country: String(record.country || countries[0] || "").trim() || undefined,
    countries,
    aliases: toStringArray(record.aliases),
    active: record.active !== false,
  };

  if (!payload.name) {
    return NextResponse.json(
      { error: "Company name is required" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("consulting_firms")
    .upsert(payload as any, { onConflict: "name" })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ record: data });
}
