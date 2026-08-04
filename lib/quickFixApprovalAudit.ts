import fs from "node:fs";
import path from "node:path";
import { writeWorkflowJson } from "./recruiterWorkflowStore";

function clean(value: any) {
  return String(Array.isArray(value) ? value.join(", ") : value ?? "").replace(/\s+/g, " ").trim();
}

function readJson(filePath: string) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) return null;
  try { return JSON.parse(fs.readFileSync(fullPath, "utf8")); } catch { return null; }
}

export function buildQuickFixApprovalAudit(options: { approvalsPath?: string } = {}) {
  const approvalsPath = options.approvalsPath || path.join("reports", "ai-extraction-approvals.json");
  const parsed = readJson(approvalsPath);
  const allApprovals = Array.isArray(parsed?.approvals) ? parsed.approvals : [];
  const approvals = allApprovals.filter((approval: any) => clean(approval.source) === "quick_fix_repair" || clean(approval.decisionMode) === "quick_fix_approval");
  const approved = approvals.filter((approval: any) => clean(approval.decision) === "approve_suggestion" && clean(approval.suggestedValue));
  return {
    generatedAt: new Date().toISOString(),
    mode: "read-only quick fix approvals audit; no candidate DB writes; no staging; no apply; no delete; no OpenAI calls",
    approvalFileFound: Boolean(parsed),
    quickFixApprovalsFound: approvals.length,
    approvedCurrentCompany: approved.filter((approval: any) => clean(approval.fieldName) === "currentCompany").length,
    approvedTitle: approved.filter((approval: any) => clean(approval.fieldName) === "title").length,
    approvedPrimarySapModule: approved.filter((approval: any) => clean(approval.fieldName) === "primarySapModule").length,
    approvedLocation: approved.filter((approval: any) => clean(approval.fieldName) === "location").length,
    existingApprovalsPreserved: allApprovals.length - approvals.length,
    readyForStagingPreview: approved.length,
    blockedFromStaging: approvals.filter((approval: any) => clean(approval.decision) !== "approve_suggestion" || !clean(approval.suggestedValue)).length,
    nextRecommendedCommand: "npm run stage:ai-approved-changes -- --approvalsPath=reports/ai-extraction-approvals.json --applyPlanPath=reports/ai-extraction-apply-plan.json --dryRun --noApply",
    approvals,
  };
}

export function writeQuickFixApprovalAudit(audit: ReturnType<typeof buildQuickFixApprovalAudit>, outputPath = path.join("reports", "quick-fix-repair-approvals-audit.json")) {
  return writeWorkflowJson(outputPath, audit);
}

