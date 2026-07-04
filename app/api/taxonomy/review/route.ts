// app/api/taxonomy/review/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await supabase.from("taxonomy_review_queue").select("*").eq("status", "PENDING").order("evidence_count", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, items: data || [] });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const id = body?.id;
    const action = String(body?.action || "").toUpperCase();
    const parent = body?.parent || body?.suggested_parent || null;
    if (!id || !["APPROVE", "REJECT"].includes(action)) return NextResponse.json({ ok: false, error: "Body must include { id, action: APPROVE|REJECT }." }, { status: 400 });

    const { data: item, error: readError } = await supabase.from("taxonomy_review_queue").select("*").eq("id", id).single();
    if (readError || !item) return NextResponse.json({ ok: false, error: readError?.message || "Review item not found" }, { status: 404 });

    if (action === "APPROVE") {
      if (item.source_type === "SAP_SKILL") {
        if (!parent) return NextResponse.json({ ok: false, error: "SAP approval requires parent module." }, { status: 400 });
        await supabase.from("sap_module_aliases").upsert({ parent_module: parent, alias: item.detected_value, alias_type: "ALIAS", strength: Math.max(Number(item.confidence || 60), 60), category: "SAP", is_active: true }, { onConflict: "parent_module,alias" });
      }
      if (item.source_type === "CONSULTING_FIRM") {
        await supabase.from("consulting_aliases").upsert({ firm_name: parent || item.detected_value, alias: item.detected_value, tier: null, region: null, category: "DISCOVERED", is_active: true }, { onConflict: "firm_name,alias" });
      }
    }

    const { error: updateError } = await supabase.from("taxonomy_review_queue").update({ status: action === "APPROVE" ? "APPROVED" : "REJECTED", reviewed_at: new Date().toISOString(), reviewed_by: "admin", suggested_parent: parent || item.suggested_parent }).eq("id", id);
    if (updateError) throw updateError;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("POST /api/taxonomy/review failed:", error);
    return NextResponse.json({ ok: false, error: error?.message || "Review action failed" }, { status: 500 });
  }
}
