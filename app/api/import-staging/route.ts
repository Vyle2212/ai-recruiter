import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const batch = JSON.parse(fs.readFileSync(path.join(process.cwd(), "reports", "import", "import-staging-batch.json"), "utf8"));
    return NextResponse.json(batch);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Import staging batch unavailable" }, { status: 404 });
  }
}
