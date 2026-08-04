import { NextResponse } from "next/server";
import { buildBatchProgress } from "@/scripts/auditAiExtractionBatchProgress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await buildBatchProgress());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load batch progress" }, { status: 500 });
  }
}