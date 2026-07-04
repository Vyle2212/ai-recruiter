// app/api/taxonomy/discover/route.ts
import { NextResponse } from "next/server";
import { runTaxonomyDiscovery } from "@/lib/taxonomyDiscovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body?.limit || 1000), 3000);
    const result = await runTaxonomyDiscovery(limit);
    return NextResponse.json({ ok: true, result });
  } catch (error: any) {
    console.error("POST /api/taxonomy/discover failed:", error);
    return NextResponse.json({ ok: false, error: error?.message || "Discovery failed" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "Use POST /api/taxonomy/discover with { limit: 1000 }." });
}
