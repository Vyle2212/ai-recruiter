import { NextResponse } from "next/server";
import { loadImportMergeProposals, readImportJson } from "@/lib/importMergeFiles";
import { summarizeImportMergeProposals } from "@/lib/importMergeApproval";
import type { ImportMergeProposal } from "@/lib/importMergeTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const persisted = readImportJson<{ proposals: ImportMergeProposal[] }>("import-merge-approvals-preview.json");
    const proposals = persisted?.proposals || await loadImportMergeProposals();
    return NextResponse.json({ mode: "read-only import merge proposals; no candidate DB writes", summary: summarizeImportMergeProposals(proposals), proposals });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load import merge proposals" }, { status: 500 });
  }
}
