import { NextResponse } from "next/server";
import { buildRepairQueueAudit } from "@/lib/repairQueueAudit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const audit = buildRepairQueueAudit();
    return NextResponse.json({ summary: audit.summary, items: audit.items, generatedAt: audit.generatedAt, files: audit.files });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load repair queue" }, { status: 500 });
  }
}
