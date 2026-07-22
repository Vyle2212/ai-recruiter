import { NextResponse } from "next/server";
import { buildImportMergePlan } from "@/lib/importMergeApproval";
import { loadImportMergeProposals, readImportJson } from "@/lib/importMergeFiles";
import type { ImportMergeDecisionFile, ImportMergeProposal } from "@/lib/importMergeTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const persisted = readImportJson<{ proposals: ImportMergeProposal[] }>("import-merge-approvals-preview.json");
    const proposals = persisted?.proposals || await loadImportMergeProposals();
    const decisions: ImportMergeDecisionFile | undefined = Array.isArray(body?.decisions) ? { generatedAt: new Date().toISOString(), mode: "local import merge decisions only; no candidate DB writes", decisions: body.decisions } : undefined;
    return NextResponse.json({ ...buildImportMergePlan(proposals, decisions), candidateDbWritePerformed: false });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to preview import merge plan" }, { status: 400 });
  }
}
