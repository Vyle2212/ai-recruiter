import { NextRequest, NextResponse } from "next/server";
import { rebuildOneCandidate } from "@/lib/search/rebuildSearchIndex";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing candidate id. Use /api/admin/rebuild-candidate?id=xxx" },
        { status: 400 }
      );
    }

    const result = await rebuildOneCandidate(id);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || String(error) },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
