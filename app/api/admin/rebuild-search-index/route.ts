import { NextResponse } from "next/server";
import { rebuildSearchIndex } from "@/lib/search/rebuildSearchIndex";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await rebuildSearchIndex();

    return NextResponse.json({
      success: true,
      ...result,
      message: "candidate_search_index rebuilt successfully.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Use POST to rebuild candidate_search_index.",
    endpoint: "/api/admin/rebuild-search-index",
  });
}
