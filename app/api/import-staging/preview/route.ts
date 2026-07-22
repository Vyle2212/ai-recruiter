import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { buildImportMergePreview } from "@/lib/importStaging";
import type { ImportStagingBatch } from "@/lib/importStagingTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const batch = (body?.batch || JSON.parse(fs.readFileSync(path.join(process.cwd(), "reports", "import", "import-staging-batch.json"), "utf8"))) as ImportStagingBatch;
    return NextResponse.json(buildImportMergePreview(batch));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to build import merge preview" }, { status: 400 });
  }
}
