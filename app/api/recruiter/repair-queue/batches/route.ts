import { NextRequest, NextResponse } from "next/server";
import { buildRepairQueueAudit } from "@/lib/repairQueueAudit";
import { planRepairBatches } from "@/lib/repairQueueBatchPlanner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const audit = buildRepairQueueAudit();
    const params = req.nextUrl.searchParams;
    return NextResponse.json(planRepairBatches(audit.items, { batchSize: Number(params.get("batchSize") || 25), focus: params.get("focus") || "all" }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to plan repair batches" }, { status: 500 });
  }
}
